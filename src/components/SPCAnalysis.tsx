import React, { useMemo, useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
  BarChart, Bar, Cell, ComposedChart, Area
} from 'recharts';
import { 
  Info, Activity, AlertTriangle, CheckCircle2, TrendingUp, BarChart3, 
  Settings, Download, Share2, Filter, LayoutGrid, List, PieChart,
  Plus, Trash2, BellRing, X as CloseIcon, Maximize2
} from 'lucide-react';
import { Experiment, TestItem, Project } from '../types';
import { cn, generateMockResults } from '../lib/utils';
import { getPersistentSamples } from '../lib/persistence';
import { toast } from 'sonner';

interface SPCAnalysisProps {
  project: Project;
  experiments: Experiment[];
  testItems: TestItem[];
  selectedExperimentId?: string;
  timeRange?: string;
}

type ChartType = 'Xbar' | 'Xbar-R' | 'X' | 'P' | 'NP' | 'C' | 'U' | 'EWMA' | 'CUSUM';

export const SPCAnalysis = ({ project, experiments, testItems, selectedExperimentId = 'all', timeRange = '30' }: SPCAnalysisProps) => {
  const [selectedTestItemId, setSelectedTestItemId] = useState(testItems[0]?.id || '');
  const [allSamplesMap, setAllSamplesMap] = useState<Record<string, any[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    const fetchAllSamples = async () => {
      setIsLoading(true);
      try {
        const samplesMap: Record<string, any[]> = {};
        await Promise.all(experiments.map(async (exp) => {
          const samples = await getPersistentSamples(exp.id);
          samplesMap[exp.id] = samples;
        }));
        setAllSamplesMap(samplesMap);
      } catch (error) {
        console.error('Error fetching samples for SPC:', error);
      } finally {
        setIsLoading(false);
      }
    };
    if (experiments.length > 0) {
      fetchAllSamples();
    } else {
      setIsLoading(false);
    }
  }, [experiments]);

  React.useEffect(() => {
    if (testItems.length > 0 && (!selectedTestItemId || !testItems.some(i => i.id === selectedTestItemId))) {
      setSelectedTestItemId(testItems[0].id);
    }
  }, [testItems, selectedTestItemId]);
  const [chartType, setChartType] = useState<ChartType>('Xbar');
  const [isCauseModalOpen, setIsCauseModalOpen] = useState(false);
  const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const [anomalyCauses, setAnomalyCauses] = useState([
    { id: '1', cause: '原料變異', count: 12, color: '#f43f5e' },
    { id: '2', cause: '設備磨損', count: 8, color: '#fb923c' },
    { id: '3', cause: '人為操作', count: 5, color: '#fb7185' },
    { id: '4', cause: '環境溫度', count: 3, color: '#facc15' },
    { id: '5', cause: '其他', count: 2, color: '#94a3b8' },
  ]);

  const [notifyRules, setNotifyRules] = useState([
    { id: 'r1', name: '超出 UCL/LCL 立即通報', enabled: true, channels: ['Email', 'Line'] },
    { id: 'r2', name: '連續 9 點同側通報', enabled: false, channels: ['Email'] },
  ]);

  const handleAddCause = () => {
    const newCause = {
      id: Date.now().toString(),
      cause: '',
      count: 0,
      color: '#' + Math.floor(Math.random()*16777215).toString(16)
    };
    setAnomalyCauses([...anomalyCauses, newCause]);
  };

  const handleUpdateCause = (id: string, field: string, value: any) => {
    setAnomalyCauses(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleRemoveCause = (id: string) => {
    setAnomalyCauses(prev => prev.filter(c => c.id !== id));
  };

  const spcData = useMemo(() => {
    if (!project || !project.id) return [];
    let projectExperiments = experiments.filter(e => e.projectId === project.id);
    
    if (selectedExperimentId !== 'all') {
      projectExperiments = projectExperiments.filter(e => e.id === selectedExperimentId);
    }

    // Filter by time range
    if (timeRange !== 'all' && timeRange !== 'custom') {
      const days = parseInt(timeRange);
      if (!isNaN(days)) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        projectExperiments = projectExperiments.filter(e => new Date(e.date) >= cutoffDate);
      }
    }
    
    if (projectExperiments.length === 0 || !selectedTestItemId) return [];

    // Base data generation from real samples
    const allSamplesData: any[] = [];
    
    projectExperiments.forEach((exp) => {
      const samples = allSamplesMap[exp.id] || [];
      
      samples.forEach((sample) => {
        const result = sample.results.find((r: any) => r.testItemId === selectedTestItemId);
        
        // Use real mean if available
        let mean = result?.mean || 0;
        let rawValues = result?.rawValues || [];
        
        if (mean > 0) {
          const max = Math.max(...rawValues);
          const min = Math.min(...rawValues);
          const range = max - min;
          
          // Simulate defects for attribute charts
          const sampleSize = 100;
          const defects = sample.defects?.length || 0;
          
          allSamplesData.push({
            batch: `${exp.title} - ${sample.code}`,
            sampleCode: sample.code,
            value: mean,
            mean: mean,
            range: range,
            rawValues: rawValues,
            defects: defects,
            sampleSize: sampleSize,
            title: exp.title,
            date: exp.date,
            isMock: false
          });
        }
      });
    });

    const baseData = allSamplesData;

    if (baseData.length === 0) return [];

    // Calculate Statistics based on chart type
    const values = baseData.map(d => {
      if (chartType === 'Xbar-R') return d.mean;
      if (chartType === 'X') return d.rawValues[0];
      if (chartType === 'P') return d.defects / d.sampleSize;
      if (chartType === 'NP') return d.defects;
      if (chartType === 'C') return d.defects;
      if (chartType === 'U') return d.defects / 1; // Assuming 1 unit
      return d.value;
    });

    const overallMean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - overallMean, 2), 0) / (values.length - 1 || 1);
    const stdDev = Math.sqrt(variance);

    // Control Limits (Simplified 3-sigma)
    let UCL = overallMean + 3 * stdDev;
    let LCL = Math.max(0, overallMean - 3 * stdDev);

    // EWMA / CUSUM specific logic
    let ewmaValue = overallMean;
    let cusumValue = 0;
    const lambda = 0.2;

    return baseData.map((d, i) => {
      const currentVal = values[i];
      
      // EWMA calculation
      ewmaValue = lambda * currentVal + (1 - lambda) * ewmaValue;
      
      // CUSUM calculation
      cusumValue += (currentVal - overallMean);

      return {
        ...d,
        displayValue: parseFloat(currentVal.toFixed(3)),
        ewma: parseFloat(ewmaValue.toFixed(3)),
        cusum: parseFloat(cusumValue.toFixed(3)),
        CL: parseFloat(overallMean.toFixed(3)),
        UCL: parseFloat(UCL.toFixed(3)),
        LCL: parseFloat(LCL.toFixed(3)),
        isOut: currentVal > UCL || currentVal < LCL
      };
    });
  }, [project?.id, experiments, selectedTestItemId, chartType, selectedExperimentId, timeRange, allSamplesMap]);

  const stats = useMemo(() => {
    if (spcData.length === 0) return null;
    const values = spcData.map(d => d.displayValue);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const std = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (values.length - 1 || 1));
    
    // Cp/Cpk calculation
    const spec = project?.specs?.[selectedTestItemId];
    let cp = 0, cpk = 0;
    if (spec?.min !== undefined && spec?.max !== undefined) {
      cp = (spec.max - spec.min) / (6 * std);
      cpk = Math.min((spec.max - mean) / (3 * std), (mean - spec.min) / (3 * std));
    }

    return { mean, max, min, std, cp, cpk, range: max - min };
  }, [spcData, project?.specs, selectedTestItemId]);

  const selectedTestItem = testItems.find(t => t.id === selectedTestItemId);
  const outOfControlPoints = spcData.filter(d => d.isOut).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">SPC 專業製程管制中心</h2>
          <p className="text-xs sm:text-sm text-slate-500">多維度品質監控與統計分析儀表板</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 sm:flex-none flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              value={selectedTestItemId}
              onChange={(e) => setSelectedTestItemId(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-600 outline-none flex-1"
            >
              {testItems.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 sm:flex-none flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <Settings className="w-4 h-4 text-slate-400" />
            <select 
              value={chartType}
              onChange={(e) => setChartType(e.target.value as ChartType)}
              className="bg-transparent text-sm font-bold text-slate-600 outline-none flex-1"
            >
              <optgroup label="計量值管制圖">
                <option value="Xbar">X-bar Chart (平均值)</option>
                <option value="Xbar-R">Xbar-R Chart (平均值-全距)</option>
                <option value="X">X Chart (個別值)</option>
              </optgroup>
              <optgroup label="計數值管制圖">
                <option value="P">P-Chart (不良率)</option>
                <option value="NP">NP-Chart (不良數)</option>
                <option value="C">C-Chart (缺點數)</option>
                <option value="U">U-Chart (單位缺點數)</option>
              </optgroup>
              <optgroup label="進階分析圖">
                <option value="EWMA">EWMA-Chart (指數加權)</option>
                <option value="CUSUM">CUSUM-Chart (累積和)</option>
              </optgroup>
            </select>
          </div>

          <button className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-brand-600 rounded-xl transition-all shadow-sm">
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="glass-panel p-6 rounded-2xl border-l-4 border-l-brand-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">平均數 (Mean)</p>
            <Activity className="w-4 h-4 text-brand-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats?.mean.toFixed(3)}</p>
          <p className="text-[10px] text-slate-400 mt-1">全距: {stats?.range.toFixed(3)}</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">標準差 (Std Dev)</p>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats?.std.toFixed(4)}</p>
          <p className="text-[10px] text-slate-400 mt-1">變異係數: {((stats?.std || 0) / (stats?.mean || 1) * 100).toFixed(2)}%</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">製程能力 (Cpk)</p>
            <BarChart3 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats?.cpk.toFixed(2)}</p>
          <p className="text-[10px] text-slate-400 mt-1">Cp: {stats?.cp.toFixed(2)}</p>
        </div>

        <div className={cn(
          "glass-panel p-6 rounded-2xl border-l-4",
          outOfControlPoints > 0 ? "border-l-rose-500 bg-rose-50/30" : "border-l-emerald-500"
        )}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">失控點監控</p>
            {outOfControlPoints > 0 ? <AlertTriangle className="w-4 h-4 text-rose-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          </div>
          <p className={cn("text-2xl font-bold", outOfControlPoints > 0 ? "text-rose-600" : "text-emerald-600")}>
            {outOfControlPoints} <span className="text-sm font-normal text-slate-400">Points</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Nelson Rules 檢測中</p>
        </div>
      </div>

      {/* Main Chart Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
          <div className="glass-panel p-8 rounded-2xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {chartType} 管制圖 - {selectedTestItem?.name}
                </h3>
                <p className="text-xs text-slate-500">動態顯示資料點資訊與管制界限</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-brand-500"></div>
                  <span className="text-[10px] font-bold text-slate-400">CL</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-400"></div>
                  <span className="text-[10px] font-bold text-slate-400">UCL/LCL</span>
                </div>
                <button 
                  onClick={() => setIsFullScreen(true)}
                  className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="h-[450px] w-full overflow-x-auto pb-4 touch-pan-x custom-scrollbar force-scrollbar">
              <div className="h-full min-w-[800px] lg:min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={spcData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }} style={{ outline: 'none' }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="batch" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10, angle: -45, textAnchor: 'end' }} 
                    height={80}
                    interval={0}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-4 rounded-xl shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
                            <p className="text-xs font-bold text-slate-900 mb-2">
                              {data.batch}
                              {data.isMock && <span className="ml-2 px-1.5 py-0.5 bg-slate-100 text-slate-400 text-[8px] rounded">模擬數據</span>}
                            </p>
                            <div className="space-y-1">
                              <p className="text-[10px] text-slate-500 flex justify-between gap-4">
                                <span>量測值:</span> <span className="font-bold text-slate-900">{data.displayValue}</span>
                              </p>
                              <p className="text-[10px] text-slate-500 flex justify-between gap-4">
                                <span>日期:</span> <span className="font-medium">{data.date}</span>
                              </p>
                              {data.isOut && (
                                <p className="text-[10px] text-rose-500 font-bold mt-2 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> 超出管制界限!
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend verticalAlign="top" height={36}/>
                  
                  {/* Control Limits Area */}
                  <Area 
                    type="monotone" 
                    dataKey="UCL" 
                    stroke="none" 
                    fill="#fef2f2" 
                    fillOpacity={0.5} 
                    name="管制範圍"
                  />
                  
                  <ReferenceLine y={spcData[0]?.CL} stroke="#94a3b8" strokeWidth={2} label={{ position: 'right', value: 'CL', fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                  <ReferenceLine y={spcData[0]?.UCL} stroke="#fb7185" strokeDasharray="5 5" strokeWidth={2} label={{ position: 'right', value: 'UCL', fill: '#fb7185', fontSize: 10, fontWeight: 'bold' }} />
                  <ReferenceLine y={spcData[0]?.LCL} stroke="#fb7185" strokeDasharray="5 5" strokeWidth={2} label={{ position: 'right', value: 'LCL', fill: '#fb7185', fontSize: 10, fontWeight: 'bold' }} />
                  
                  <Line 
                    type="monotone" 
                    dataKey={chartType === 'EWMA' ? 'ewma' : chartType === 'CUSUM' ? 'cusum' : 'displayValue'} 
                    name={chartType}
                    stroke="#0ea5e9" 
                    strokeWidth={3} 
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      const isOut = payload.isOut;
                      return (
                        <circle 
                          cx={cx} cy={cy} r={isOut ? 6 : 4} 
                          fill={isOut ? "#f43f5e" : "#0ea5e9"} 
                          stroke="#fff" strokeWidth={2} 
                          className="transition-all duration-300"
                        />
                      );
                    }}
                    activeDot={{ r: 8, strokeWidth: 0 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

          {/* Statistical Table */}
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900">統計製程分析表</h3>
              <button className="text-xs font-bold text-brand-600 hover:underline flex items-center gap-1">
                <Download className="w-3 h-3" /> 匯出 CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">批次</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">量測值</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">CL</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">UCL</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">LCL</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {spcData.map((d, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 text-xs font-medium text-slate-900">{d.batch}</td>
                      <td className="px-6 py-3 text-xs font-mono text-slate-600">{d.displayValue}</td>
                      <td className="px-6 py-3 text-xs font-mono text-slate-400">{d.CL}</td>
                      <td className="px-6 py-3 text-xs font-mono text-rose-400">{d.UCL}</td>
                      <td className="px-6 py-3 text-xs font-mono text-rose-400">{d.LCL}</td>
                      <td className="px-6 py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold",
                          d.isOut ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                        )}>
                          {d.isOut ? '失控' : '穩定'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar Analysis */}
        <div className="space-y-8">
          {/* Pareto Chart for Anomaly Causes */}
          <div className="glass-panel p-8 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-rose-500" />
                異常要因分析 (Pareto)
              </h3>
              <button 
                onClick={() => setIsCauseModalOpen(true)}
                className="p-2 text-slate-400 hover:text-brand-600 hover:bg-slate-50 rounded-lg transition-all"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
            <div className="h-[300px] w-full mb-6 overflow-x-auto pb-4 touch-pan-x custom-scrollbar force-scrollbar">
              <div className="h-full min-w-[400px] lg:min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={anomalyCauses} layout="vertical" margin={{ left: 20 }} style={{ outline: 'none' }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="cause" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {anomalyCauses.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
            <div className="space-y-3">
              {anomalyCauses.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-xs text-slate-600">{item.cause || '未命名原因'}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-900">{item.count} 次</span>
                </div>
              ))}
            </div>
          </div>

          {/* Nelson Rules Info */}
          <div className="glass-panel p-6 rounded-2xl bg-indigo-50/50 border border-indigo-100">
            <h4 className="text-sm font-bold text-indigo-900 mb-4 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Nelson Rules 判讀指南
            </h4>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded bg-rose-100 text-rose-600 flex items-center justify-center text-[10px] font-bold shrink-0">R1</div>
                <p className="text-[10px] text-indigo-700 leading-relaxed">
                  <span className="font-bold">點超出管制界限：</span> 任何點落在 UCL 或 LCL 之外。
                </p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded bg-amber-100 text-amber-600 flex items-center justify-center text-[10px] font-bold shrink-0">R2</div>
                <p className="text-[10px] text-indigo-700 leading-relaxed">
                  <span className="font-bold">連續 9 點在同側：</span> 表示製程平均值發生偏移。
                </p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">R3</div>
                <p className="text-[10px] text-indigo-700 leading-relaxed">
                  <span className="font-bold">連續 6 點遞增/遞減：</span> 表示製程存在趨勢性漂移。
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="glass-panel p-6 rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-200">
            <h4 className="text-sm font-bold mb-2">即時異常通報</h4>
            <p className="text-[10px] text-brand-100 mb-4">偵測到異常時自動發送通知至相關單位</p>
            <button 
              onClick={() => setIsNotifyModalOpen(true)}
              className="w-full py-2 bg-white text-brand-600 rounded-lg text-xs font-bold hover:bg-brand-50 transition-colors"
            >
              設定通報規則
            </button>
          </div>
        </div>
      </div>

      {/* Anomaly Cause Modal */}
      {isCauseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">管理異常原因數據</h3>
              <button onClick={() => setIsCauseModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <CloseIcon className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {anomalyCauses.map(c => (
                <div key={c.id} className="flex items-center gap-3">
                  <input 
                    type="text" 
                    value={c.cause}
                    onChange={(e) => handleUpdateCause(c.id, 'cause', e.target.value)}
                    placeholder="原因名稱"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500"
                  />
                  <input 
                    type="number" 
                    value={c.count}
                    onChange={(e) => handleUpdateCause(c.id, 'count', parseInt(e.target.value))}
                    className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500"
                  />
                  <button onClick={() => handleRemoveCause(c.id)} className="text-slate-300 hover:text-rose-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button 
                onClick={handleAddCause}
                className="w-full py-2 border-2 border-dashed border-slate-200 text-slate-400 rounded-lg text-sm font-bold hover:border-brand-500 hover:text-brand-500 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> 新增原因
              </button>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setIsCauseModalOpen(false)}
                className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 transition-all"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Rules Modal */}
      {isNotifyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">設定通報規則</h3>
              <button onClick={() => setIsNotifyModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <CloseIcon className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {notifyRules.map(rule => (
                <div key={rule.id} className="flex items-start justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-900">{rule.name}</p>
                    <div className="flex gap-2">
                      {rule.channels.map(c => (
                        <span key={c} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-500">{c}</span>
                      ))}
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setNotifyRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
                      toast.success(`規則已${!rule.enabled ? '啟用' : '停用'}`);
                    }}
                    className={cn(
                      "w-10 h-5 rounded-full transition-colors relative",
                      rule.enabled ? "bg-brand-600" : "bg-slate-300"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                      rule.enabled ? "right-1" : "left-1"
                    )}></div>
                  </button>
                </div>
              ))}
              <button className="w-full py-3 bg-brand-50 text-brand-600 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-brand-100 transition-all">
                <BellRing className="w-4 h-4" /> 新增通報規則
              </button>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setIsNotifyModalOpen(false)}
                className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 transition-all"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Full Screen Chart Modal */}
      {isFullScreen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl w-full h-full max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {chartType} 管制圖 - {selectedTestItem?.name} (全螢幕)
                </h3>
                <p className="text-sm text-slate-500">{project.name}</p>
              </div>
              <button 
                onClick={() => setIsFullScreen(false)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <Maximize2 className="w-6 h-6 rotate-90 text-slate-400" />
              </button>
            </div>
            <div className="flex-1 p-8 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={spcData} margin={{ top: 20, right: 40, left: 20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="batch" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12, angle: -45, textAnchor: 'end' }} 
                    height={100}
                    interval={0}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 14 }}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-6 rounded-2xl shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
                            <p className="text-sm font-bold text-slate-900 mb-3">
                              {data.batch}
                              {data.isMock && <span className="ml-2 px-2 py-1 bg-slate-100 text-slate-400 text-[10px] rounded">模擬數據</span>}
                            </p>
                            <div className="space-y-2">
                              <p className="text-xs text-slate-500 flex justify-between gap-8">
                                <span>量測值:</span> <span className="font-bold text-slate-900">{data.displayValue}</span>
                              </p>
                              <p className="text-xs text-slate-500 flex justify-between gap-8">
                                <span>日期:</span> <span className="font-medium">{data.date}</span>
                              </p>
                              {data.isOut && (
                                <p className="text-xs text-rose-500 font-bold mt-3 flex items-center gap-2">
                                  <AlertTriangle className="w-4 h-4" /> 超出管制界限!
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend verticalAlign="top" height={48} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                  
                  <Area 
                    type="monotone" 
                    dataKey="UCL" 
                    stroke="none" 
                    fill="#fef2f2" 
                    fillOpacity={0.5} 
                    name="管制範圍"
                  />
                  
                  <ReferenceLine y={spcData[0]?.CL} stroke="#94a3b8" strokeWidth={2} label={{ position: 'right', value: 'CL', fill: '#94a3b8', fontSize: 12, fontWeight: 'bold' }} />
                  <ReferenceLine y={spcData[0]?.UCL} stroke="#fb7185" strokeDasharray="5 5" strokeWidth={2} label={{ position: 'right', value: 'UCL', fill: '#fb7185', fontSize: 12, fontWeight: 'bold' }} />
                  <ReferenceLine y={spcData[0]?.LCL} stroke="#fb7185" strokeDasharray="5 5" strokeWidth={2} label={{ position: 'right', value: 'LCL', fill: '#fb7185', fontSize: 12, fontWeight: 'bold' }} />
                  
                  <Line 
                    type="monotone" 
                    dataKey={chartType === 'EWMA' ? 'ewma' : chartType === 'CUSUM' ? 'cusum' : 'displayValue'} 
                    name={chartType}
                    stroke="#0ea5e9" 
                    strokeWidth={4} 
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      const isOut = payload.isOut;
                      return (
                        <circle 
                          cx={cx} cy={cy} r={isOut ? 8 : 6} 
                          fill={isOut ? "#f43f5e" : "#0ea5e9"} 
                          stroke="#fff" strokeWidth={3} 
                          className="transition-all duration-300"
                        />
                      );
                    }}
                    activeDot={{ r: 10, strokeWidth: 0 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setIsFullScreen(false)}
                className="px-8 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-200"
              >
                關閉全螢幕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
