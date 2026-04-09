import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, ReferenceLine, Legend, Area
} from 'recharts';
import { 
  TrendingUp, 
  AlertCircle, 
  ArrowUpRight,
  ArrowDownRight,
  ClipboardList,
  Beaker,
  Database,
  Filter,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Bell,
  Calendar as CalendarIcon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  getPersistentProjects, 
  getPersistentExperiments, 
  getPersistentSamples,
  getPersistentTestItems
} from '../lib/persistence';
import { useAuth } from './AuthContext';
import { TodoList, BulletinBoard, DashboardCalendar } from './DashboardWidgets';
import { calculateStats, detectNelsonRules } from '../lib/statsUtils';

const StatCard = ({ title, value, trend, trendValue, icon: Icon, color, onClick }: any) => (
  <div 
    onClick={onClick}
    className="glass-panel p-6 rounded-2xl cursor-pointer hover:shadow-md transition-all active:scale-95 group"
  >
    <div className="flex items-start justify-between mb-4">
      <div className={cn("p-3 rounded-xl group-hover:scale-110 transition-transform", color)}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      {trend && (
        <div className={cn(
          "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full",
          trend === 'up' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
        )}>
          {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trendValue}
        </div>
      )}
    </div>
    <h3 className="text-slate-500 text-sm font-medium mb-1">{title}</h3>
    <p className="text-2xl font-bold text-slate-900">{value}</p>
  </div>
);

export const Dashboard = () => {
  const navigate = useNavigate();
  const { user, canAccessProject } = useAuth();
  
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [allExperiments, setAllExperiments] = useState<any[]>([]);
  const [testItems, setTestItems] = useState<any[]>([]);
  const [allSamplesMap, setAllSamplesMap] = useState<Record<string, any[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [projectsData, experimentsData, testItemsData] = await Promise.all([
          getPersistentProjects(),
          getPersistentExperiments(),
          getPersistentTestItems()
        ]);
        
        setAllProjects(projectsData);
        setAllExperiments(experimentsData);
        setTestItems(testItemsData);

        // Fetch samples for each experiment
        const samplesPromises = experimentsData.map(exp => getPersistentSamples(exp.id));
        const samplesResults = await Promise.all(samplesPromises);
        const samplesMap: Record<string, any[]> = {};
        experimentsData.forEach((exp, index) => {
          samplesMap[exp.id] = samplesResults[index];
        });
        setAllSamplesMap(samplesMap);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast.error('讀取數據失敗');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const projects = useMemo(() => 
    allProjects.filter(p => canAccessProject(p.id)),
    [allProjects, canAccessProject]
  );

  const experiments = useMemo(() => 
    allExperiments.filter(e => canAccessProject(e.projectId)),
    [allExperiments, canAccessProject]
  );
  
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [selectedExperimentId, setSelectedExperimentId] = useState('all');
  const [selectedTestItemId, setSelectedTestItemId] = useState('');
  const [timeRange, setTimeRange] = useState('all');
  const [chartType, setChartType] = useState<'Xbar' | 'Xbar-R' | 'X' | 'EWMA' | 'CUSUM'>('Xbar');

  const uniqueTestItems = useMemo(() => {
    const seen = new Set();
    return testItems.filter(item => {
      if (seen.has(item.name)) return false;
      seen.add(item.name);
      return true;
    });
  }, [testItems]);

  useEffect(() => {
    if (uniqueTestItems.length > 0 && !selectedTestItemId) {
      setSelectedTestItemId(uniqueTestItems[0].id);
    }
  }, [uniqueTestItems, selectedTestItemId]);

  // Update selected project if it's no longer accessible
  useEffect(() => {
    if (selectedProjectId !== 'all' && !canAccessProject(selectedProjectId)) {
      setSelectedProjectId('all');
    }
  }, [projects, canAccessProject, selectedProjectId]);

  const handleExport = () => {
    toast.success('正在準備報表匯出...', { description: '系統正在處理數據，請稍候。' });
  };

  const handleAddExperiment = () => {
    navigate('/experiments');
    toast.info('請選擇一個專案以新增實驗紀錄。');
  };

  // Get all anomalies across all experiments
  const allAnomalies = useMemo(() => {
    const anomalies: any[] = [];
    experiments.forEach(exp => {
      const samples = allSamplesMap[exp.id] || [];
      samples.forEach(sample => {
        sample.results.forEach((res: any) => {
          if (res.isAnomaly) {
            const item = testItems.find(i => i.id === res.testItemId);
            anomalies.push({
              experimentId: exp.id,
              experimentTitle: exp.title,
              sampleCode: sample.code,
              itemName: item?.name || '未知項目',
              value: res.mean,
              unit: item?.unit || '',
              date: exp.date
            });
          }
        });
      });
    });
    // Sort by date descending
    return anomalies.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [experiments, testItems, allSamplesMap]);

  const spcData = useMemo(() => {
    if (!selectedTestItemId) return [];
    
    const allSamplesData: any[] = [];
    
    // Filter experiments based on selected project and experiment
    let filteredExperiments = experiments.filter(exp => {
      const matchProject = selectedProjectId === 'all' || exp.projectId === selectedProjectId;
      const matchExperiment = selectedExperimentId === 'all' || exp.id === selectedExperimentId;
      return matchProject && matchExperiment;
    });

    // Filter by time range
    if (timeRange !== 'all') {
      const days = parseInt(timeRange);
      if (!isNaN(days)) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        filteredExperiments = filteredExperiments.filter(e => new Date(e.date) >= cutoffDate);
      }
    }

    filteredExperiments.forEach((exp) => {
      const samples = allSamplesMap[exp.id] || [];
      samples.forEach((sample) => {
        const result = sample.results.find((r: any) => r.testItemId === selectedTestItemId);
        if (result && result.mean > 0) {
          const max = Math.max(...(result.rawValues || []));
          const min = Math.min(...(result.rawValues || []));
          allSamplesData.push({
            batch: `${exp.title.substring(0, 5)}... ${sample.code}`,
            fullBatch: `${exp.title} - ${sample.code}`,
            value: result.mean,
            range: max - min,
            isMock: false
          });
        }
      });
    });

    if (allSamplesData.length === 0) return [];

    const values = allSamplesData.map(d => d.value);
    const stats = calculateStats(values);
    const overallMean = stats.mean;
    const stdDev = stats.stdDev;

    let UCL = overallMean + 3 * stdDev;
    let LCL = overallMean - 3 * stdDev;

    let ewmaValue = overallMean;
    let cusumValue = 0;
    const lambda = 0.2;

    const nelsonViolations = detectNelsonRules(values, overallMean, stdDev);

    return allSamplesData.map((d, i) => {
      const currentVal = values[i];
      ewmaValue = lambda * currentVal + (1 - lambda) * ewmaValue;
      cusumValue += (currentVal - overallMean);

      const pointViolations = nelsonViolations.filter(v => v.index === i);

      return {
        ...d,
        displayValue: parseFloat(currentVal.toFixed(3)),
        ewma: parseFloat(ewmaValue.toFixed(3)),
        cusum: parseFloat(cusumValue.toFixed(3)),
        CL: parseFloat(overallMean.toFixed(3)),
        UCL: parseFloat(UCL.toFixed(3)),
        LCL: parseFloat(LCL.toFixed(3)),
        range: [parseFloat(LCL.toFixed(3)), parseFloat(UCL.toFixed(3))],
        isOut: currentVal > UCL || currentVal < LCL,
        violations: pointViolations.map(v => v.rule)
      };
    });
  }, [experiments, selectedTestItemId, chartType, selectedProjectId, selectedExperimentId, timeRange, allSamplesMap]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">研發概況儀表板</h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">歡迎回來，這是您目前的專案進度摘要。</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExport}
            className="flex-1 sm:flex-none px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
          >
            匯出報表
          </button>
          <button 
            onClick={handleAddExperiment}
            className="flex-1 sm:flex-none px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-all shadow-lg shadow-brand-200"
          >
            新增實驗
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="進行中專案" 
          value={projects.filter(p => p.status === 'In Progress').length.toString()} 
          trend="up" 
          trendValue="+0" 
          icon={ClipboardList} 
          color="bg-brand-500" 
          onClick={() => navigate('/projects')}
        />
        <StatCard 
          title="異常警示" 
          value={allAnomalies.length.toString()} 
          trend={allAnomalies.length > 5 ? "up" : "down"} 
          trendValue={allAnomalies.length > 0 ? "需注意" : "良好"} 
          icon={AlertCircle} 
          color="bg-amber-500" 
          onClick={() => {
            const section = document.getElementById('recent-anomalies');
            if (section) {
              section.scrollIntoView({ behavior: 'smooth' });
            } else {
              navigate('/experiments');
            }
          }}
        />
        <StatCard 
          title="總實驗數" 
          value={experiments.length.toString()} 
          trend="up" 
          trendValue="持續增加" 
          icon={Beaker} 
          color="bg-indigo-500" 
          onClick={() => navigate('/experiments')}
        />
      </div>

      {/* Widgets Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <TodoList />
        <BulletinBoard />
        <DashboardCalendar />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Control Chart */}
        <div className="lg:col-span-2 glass-panel p-6 sm:p-8 rounded-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div className="flex-1 min-w-[200px]">
              <h2 className="text-lg font-bold text-slate-900">品質管制圖 (Control Chart)</h2>
              <p className="text-sm text-slate-500">
                跨專案與實驗的品質趨勢分析
              </p>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <select 
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  setSelectedExperimentId('all');
                }}
                className="flex-1 sm:flex-none bg-slate-50 border-none text-sm font-medium text-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">所有專案</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select 
                value={selectedExperimentId}
                onChange={(e) => setSelectedExperimentId(e.target.value)}
                className="flex-1 sm:flex-none bg-slate-50 border-none text-sm font-medium text-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">所有實驗</option>
                {experiments
                  .filter(e => selectedProjectId === 'all' || e.projectId === selectedProjectId)
                  .map(e => (
                    <option key={e.id} value={e.id}>{e.title}</option>
                  ))
                }
              </select>
              <select 
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="flex-1 sm:flex-none bg-slate-50 border-none text-sm font-medium text-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">全部時間</option>
                <option value="30">最近 30 天</option>
                <option value="90">最近 90 天</option>
              </select>
              <select 
                value={selectedTestItemId}
                onChange={(e) => setSelectedTestItemId(e.target.value)}
                className="flex-1 sm:flex-none bg-slate-50 border-none text-sm font-medium text-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
              >
                {uniqueTestItems.map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <select 
                value={chartType}
                onChange={(e) => setChartType(e.target.value as any)}
                className="flex-1 sm:flex-none bg-slate-50 border-none text-sm font-medium text-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="Xbar">X-bar (平均值)</option>
                <option value="X">X (個別值)</option>
                <option value="EWMA">EWMA (指數加權)</option>
                <option value="CUSUM">CUSUM (累積和)</option>
              </select>
            </div>
          </div>
          <div className="h-[300px] w-full overflow-x-auto pb-4 touch-pan-x custom-scrollbar force-scrollbar">
            <div className="h-full min-w-[800px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={spcData} style={{ outline: 'none' }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="batch" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10 }} 
                    domain={['auto', 'auto']}
                  />
                  <Tooltip 
                    isAnimationActive={false}
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                    }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-4 rounded-xl shadow-2xl border border-slate-100 min-w-[200px]">
                            <p className="text-xs font-bold text-slate-900 mb-2">{data.fullBatch}</p>
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center gap-4">
                                <span className="text-[10px] text-slate-500">量測值:</span>
                                <span className="text-xs font-bold text-brand-600">{data.displayValue}</span>
                              </div>
                              <div className="h-px bg-slate-100 my-1" />
                              <div className="flex justify-between items-center gap-4">
                                <span className="text-[10px] text-slate-500">UCL:</span>
                                <span className="text-[10px] font-medium text-rose-500">{data.UCL}</span>
                              </div>
                              <div className="flex justify-between items-center gap-4">
                                <span className="text-[10px] text-slate-500">CL:</span>
                                <span className="text-[10px] font-medium text-slate-400">{data.CL}</span>
                              </div>
                              <div className="flex justify-between items-center gap-4">
                                <span className="text-[10px] text-slate-500">LCL:</span>
                                <span className="text-[10px] font-medium text-rose-500">{data.LCL}</span>
                              </div>
                              
                              {data.violations && data.violations.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-rose-100">
                                  <p className="text-[10px] text-rose-500 font-bold mb-1 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> 異常趨勢:
                                  </p>
                                  {data.violations.map((v: string, idx: number) => (
                                    <p key={idx} className="text-[9px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded mt-0.5">{v}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend verticalAlign="top" height={36}/>
                  
                  {spcData.length > 0 && (
                    <>
                      <Area 
                        type="monotone" 
                        dataKey="range" 
                        stroke="none" 
                        fill="#fef2f2" 
                        fillOpacity={0.6} 
                        name="管制範圍"
                        isAnimationActive={false}
                      />
                      
                      <ReferenceLine y={spcData[0].CL} stroke="#94a3b8" strokeWidth={1.5} label={{ position: 'right', value: 'CL', fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} />
                      <ReferenceLine y={spcData[0].UCL} stroke="#fb7185" strokeDasharray="3 3" strokeWidth={1.5} label={{ position: 'right', value: 'UCL', fill: '#fb7185', fontSize: 9, fontWeight: 'bold' }} />
                      <ReferenceLine y={spcData[0].LCL} stroke="#fb7185" strokeDasharray="3 3" strokeWidth={1.5} label={{ position: 'right', value: 'LCL', fill: '#fb7185', fontSize: 9, fontWeight: 'bold' }} />
                    </>
                  )}
                  
                  <Line 
                    type="monotone" 
                    dataKey={chartType === 'EWMA' ? 'ewma' : chartType === 'CUSUM' ? 'cusum' : 'displayValue'} 
                    name={chartType}
                    stroke="#0ea5e9" 
                    strokeWidth={4} 
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      const hasViolations = payload.violations && payload.violations.length > 0;
                      return (
                        <circle 
                          cx={cx} cy={cy} r={hasViolations ? 6 : 4} 
                          fill={hasViolations ? "#f43f5e" : "#0ea5e9"} 
                          stroke="#fff" strokeWidth={2} 
                        />
                      );
                    }}
                    activeDot={{ r: 8, strokeWidth: 2, stroke: '#fff' }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Projects / Status */}
        <div className="glass-panel p-8 rounded-2xl">
          <h2 className="text-lg font-bold text-slate-900 mb-6">最近專案</h2>
          <div className="space-y-6">
            {projects.slice(0, 3).map((project) => (
              <div key={project.id} className="flex items-start gap-4">
                <div className={cn(
                  "w-2 h-2 rounded-full mt-2 shrink-0",
                  project.status === 'In Progress' ? "bg-brand-500" : "bg-slate-300"
                )}></div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 truncate">{project.name}</h4>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">{project.description}</p>
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full" style={{ width: '65%' }}></div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">65%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button 
            onClick={() => navigate('/projects')}
            className="w-full mt-8 py-3 text-sm font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-xl transition-colors"
          >
            查看所有專案
          </button>
        </div>
      </div>

      {/* Bottom Row: Alerts & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Anomaly Alerts */}
        <div id="recent-anomalies" className="glass-panel p-8 rounded-2xl border-l-4 border-l-amber-500 scroll-mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              最近異常紀錄
            </h2>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
              {allAnomalies.length} 筆紀錄
            </span>
          </div>
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
            {allAnomalies.length > 0 ? (
              allAnomalies.slice(0, 5).map((anomaly, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
                      <Beaker className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{anomaly.experimentTitle} - {anomaly.sampleCode}</p>
                      <p className="text-xs text-slate-500">{anomaly.itemName} 異常 ({anomaly.value} {anomaly.unit})</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate(`/experiments/${anomaly.experimentId}`)}
                    className="text-xs font-bold text-brand-600 hover:underline"
                  >
                    檢視
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-400 italic text-sm">
                目前無異常紀錄
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="glass-panel p-8 rounded-2xl">
          <h2 className="text-lg font-bold text-slate-900 mb-6">快速操作</h2>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => {
                navigate('/projects');
                toast.info('進入專案管理頁面以建立新專案。');
              }}
              className="p-4 rounded-xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <ClipboardList className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-slate-900">建立專案</p>
              <p className="text-xs text-slate-500 mt-1">設定新的研發目標</p>
            </button>
            <button 
              onClick={() => {
                navigate('/experiments');
                toast.info('選擇一個實驗以進行數據輸入。');
              }}
              className="p-4 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Database className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-slate-900">數據輸入</p>
              <p className="text-xs text-slate-500 mt-1">新增測試結果</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
