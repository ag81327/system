import React, { useMemo, useState, useEffect } from 'react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Line, ComposedChart, Cell, Legend, ReferenceLine
} from 'recharts';
import { 
  Zap, Info, Activity, TrendingUp, BarChart3, 
  Settings, Download, Filter, ArrowRightLeft,
  Search, AlertCircle
} from 'lucide-react';
import { Experiment, TestItem, Project } from '../types';
import { cn } from '../lib/utils';
import { getPersistentSamples } from '../lib/persistence';
import { calculateLinearRegression } from '../lib/statsUtils';

interface CorrelationAnalysisProps {
  project: Project;
  experiments: Experiment[];
  testItems: TestItem[];
  selectedExperimentId?: string;
  timeRange?: string;
}

export const CorrelationAnalysis = ({ project, experiments, testItems, selectedExperimentId = 'all', timeRange = '30' }: CorrelationAnalysisProps) => {
  const uniqueTestItems = useMemo(() => {
    const seen = new Set();
    return testItems.filter(item => {
      if (seen.has(item.name)) return false;
      seen.add(item.name);
      return true;
    });
  }, [testItems]);

  const [itemXId, setItemXId] = useState(uniqueTestItems[0]?.id || '');
  const [itemYId, setItemYId] = useState(uniqueTestItems[1]?.id || uniqueTestItems[0]?.id || '');
  const [allSamplesMap, setAllSamplesMap] = useState<Record<string, any[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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
        console.error('Error fetching samples for Correlation:', error);
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

  const correlationData = useMemo(() => {
    if (!itemXId || !itemYId || !allSamplesMap) return [];

    const itemX = testItems.find(t => t.id === itemXId);
    const itemY = testItems.find(t => t.id === itemYId);
    if (!itemX || !itemY) return [];

    let filteredExperiments = experiments.filter(e => e.projectId === project.id);
    if (selectedExperimentId !== 'all') {
      filteredExperiments = filteredExperiments.filter(e => e.id === selectedExperimentId);
    }

    const data: any[] = [];
    filteredExperiments.forEach(exp => {
      const samples = allSamplesMap[exp.id] || [];
      samples.forEach(sample => {
        const resX = sample.results.find((r: any) => {
          const it = testItems.find(t => t.id === r.testItemId);
          return it?.name === itemX.name;
        });
        const resY = sample.results.find((r: any) => {
          const it = testItems.find(t => t.id === r.testItemId);
          return it?.name === itemY.name;
        });

        if (resX && resY && resX.mean > 0 && resY.mean > 0) {
          data.push({
            x: resX.mean,
            y: resY.mean,
            batch: `${exp.title} - ${sample.code}`,
            date: exp.date
          });
        }
      });
    });

    return data;
  }, [project.id, experiments, itemXId, itemYId, allSamplesMap, testItems, selectedExperimentId]);

  const regression = useMemo(() => {
    return calculateLinearRegression(correlationData);
  }, [correlationData]);

  const trendLineData = useMemo(() => {
    if (correlationData.length < 2) return [];
    const minX = Math.min(...correlationData.map(d => d.x));
    const maxX = Math.max(...correlationData.map(d => d.x));
    
    return [
      { x: minX, trend: regression.m * minX + regression.b },
      { x: maxX, trend: regression.m * maxX + regression.b }
    ];
  }, [correlationData, regression]);

  const itemX = testItems.find(t => t.id === itemXId);
  const itemY = testItems.find(t => t.id === itemYId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Controls */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-center gap-6 bg-slate-50/50 border-slate-200">
        <div className="flex-1 w-full space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">X 軸指標 (自變數)</label>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <Activity className="w-4 h-4 text-brand-500" />
            <select 
              value={itemXId}
              onChange={(e) => setItemXId(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-600 outline-none flex-1"
            >
              {uniqueTestItems.map(item => (
                <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="shrink-0 p-2 bg-white rounded-full shadow-sm border border-slate-100 hidden md:block">
          <ArrowRightLeft className="w-4 h-4 text-slate-300" />
        </div>

        <div className="flex-1 w-full space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Y 軸指標 (應變數)</label>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            <select 
              value={itemYId}
              onChange={(e) => setItemYId(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-600 outline-none flex-1"
            >
              {uniqueTestItems.map(item => (
                <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Scatter Plot */}
        <div className="xl:col-span-2 glass-panel p-8 rounded-2xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-slate-900">指標關聯性分析 (Scatter Plot)</h3>
              <p className="text-xs text-slate-500">分析 {itemX?.name} 與 {itemY?.name} 的相關程度</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-brand-500"></div>
                <span className="text-[10px] font-bold text-slate-400">實驗數據</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                <span className="text-[10px] font-bold text-slate-400">趨勢線</span>
              </div>
            </div>
          </div>

          <div className="h-[450px] w-full">
            {correlationData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="x" 
                    type="number" 
                    name={itemX?.name} 
                    unit={itemX?.unit}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    label={{ value: `${itemX?.name} (${itemX?.unit})`, position: 'bottom', offset: 0, fill: '#64748b', fontSize: 12, fontWeight: 'bold' }}
                  />
                  <YAxis 
                    dataKey="y" 
                    type="number" 
                    name={itemY?.name} 
                    unit={itemY?.unit}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    label={{ value: `${itemY?.name} (${itemY?.unit})`, angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12, fontWeight: 'bold' }}
                  />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-4 rounded-xl shadow-2xl border border-slate-100 min-w-[200px]">
                            <p className="text-xs font-bold text-slate-900 mb-2">{data.batch}</p>
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-500">{itemX?.name}:</span>
                                <span className="text-xs font-bold text-brand-600">{data.x} {itemX?.unit}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-500">{itemY?.name}:</span>
                                <span className="text-xs font-bold text-indigo-600">{data.y} {itemY?.unit}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-500">日期:</span>
                                <span className="text-[10px] font-medium text-slate-400">{data.date}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Scatter 
                    name="數據點" 
                    data={correlationData} 
                    fill="#0ea5e9" 
                    fillOpacity={0.6}
                    stroke="#fff"
                    strokeWidth={1}
                  />
                  <Line 
                    data={trendLineData} 
                    type="monotone" 
                    dataKey="trend" 
                    stroke="#94a3b8" 
                    strokeWidth={2} 
                    strokeDasharray="5 5"
                    dot={false} 
                    activeDot={false}
                    name="線性趨勢"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                <Search className="w-12 h-12 opacity-20" />
                <p className="text-sm italic">目前無足夠的對應數據進行關聯分析</p>
              </div>
            )}
          </div>
        </div>

        {/* Correlation Stats */}
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl bg-brand-50/50 border-brand-100">
            <h4 className="text-sm font-bold text-brand-900 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              相關性分析結果
            </h4>
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-bold text-brand-600 uppercase tracking-wider mb-1">相關係數 (R)</p>
                <p className="text-4xl font-black text-brand-900">{regression.r.toFixed(4)}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold",
                    Math.abs(regression.r) > 0.7 ? "bg-emerald-100 text-emerald-700" : 
                    Math.abs(regression.r) > 0.4 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                  )}>
                    {Math.abs(regression.r) > 0.7 ? '強相關' : Math.abs(regression.r) > 0.4 ? '中等相關' : '弱相關'}
                  </span>
                  <span className="text-[10px] text-brand-600">
                    判定係數 R²: {(regression.r * regression.r).toFixed(4)}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-brand-100">
                <p className="text-[10px] font-bold text-brand-600 uppercase tracking-wider mb-2">回歸方程式</p>
                <div className="bg-white p-3 rounded-lg border border-brand-100 font-mono text-xs text-brand-800">
                  Y = {regression.m.toFixed(4)}X {regression.b >= 0 ? '+' : '-'} {Math.abs(regression.b).toFixed(4)}
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl">
            <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-400" />
              數據洞察
            </h4>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold shrink-0">N</div>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  共有 <span className="font-bold text-slate-900">{correlationData.length}</span> 組有效對應樣本。
                </p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold shrink-0">Dir</div>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  呈現 <span className="font-bold text-slate-900">{regression.r > 0 ? '正相關' : '負相關'}</span> 趨勢，表示 {itemX?.name} 增加時，{itemY?.name} 傾向於 {regression.r > 0 ? '增加' : '減少'}。
                </p>
              </div>
              {Math.abs(regression.r) < 0.3 && (
                <div className="flex gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-[10px] text-amber-700 leading-relaxed">
                    相關性較弱，可能存在其他關鍵影響因子，或數據分佈較為分散。
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
