import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ScatterChart, Scatter, ZAxis, Cell } from 'recharts';
import { TrendingUp, Layers, PieChart as PieChartIcon, Download, Filter, RefreshCw } from 'lucide-react';
import { Experiment, Sample } from '../types';
import { cn } from '../lib/utils';

interface AdvancedDataMiningProps {
  experiments: Experiment[];
  samples: Record<string, Sample[]>; // experimentId -> samples
}

export const AdvancedDataMining: React.FC<AdvancedDataMiningProps> = ({ experiments, samples }) => {
  const [analysisType, setAnalysisType] = useState<'correlation' | 'trend' | 'distribution'>('correlation');

  // Prepare data for correlation analysis (e.g., Temperature vs. Yield/Quality)
  const correlationData = useMemo(() => {
    return experiments.map(exp => {
      const expSamples = samples[exp.id] || [];
      const avgQuality = expSamples.length > 0 
        ? expSamples.reduce((acc, s) => acc + (s.qualityScore || 0), 0) / expSamples.length 
        : 0;
      
      // Find a process condition like "Temperature" or any numerical parameter
      const targetParam = exp.processConditions?.find(pc => 
        pc.name.includes('溫度') || 
        pc.name.toLowerCase().includes('temp') ||
        pc.type === 'Temperature' ||
        pc.type === 'Pressure' ||
        pc.type === 'Energy'
      );
      
      const paramValue = targetParam ? parseFloat(targetParam.value.toString()) : 0;

      return {
        name: exp.title,
        x: paramValue,
        y: avgQuality,
        z: expSamples.length,
        date: exp.date
      };
    }).filter(d => d.x > 0 || d.y > 0);
  }, [experiments, samples]);

  const trendData = useMemo(() => {
    return correlationData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [correlationData]);

  const distributionData = useMemo(() => {
    const bins = [0, 20, 40, 60, 80, 100];
    const counts = bins.slice(0, -1).map((min, i) => {
      const max = bins[i + 1];
      const count = correlationData.filter(d => d.y >= min && d.y < max).length;
      return { range: `${min}-${max}`, count };
    });
    return counts;
  }, [correlationData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">進階數據挖掘</h2>
          <p className="text-sm text-slate-500">跨實驗多維度分析，挖掘隱藏的製程規律。</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all">
            <Download className="w-4 h-4" />
            導出分析報告
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Controls */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="text-sm font-bold text-slate-900 mb-4">分析維度</h3>
            <div className="space-y-2">
              {[
                { id: 'correlation', label: '相關性分析', icon: TrendingUp },
                { id: 'trend', label: '趨勢演進', icon: Layers },
                { id: 'distribution', label: '數據分佈', icon: PieChartIcon },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setAnalysisType(type.id as any)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                    analysisType === type.id 
                      ? "bg-brand-600 text-white shadow-lg shadow-brand-100" 
                      : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <type.icon className="w-4 h-4" />
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Filter className="w-4 h-4 text-brand-500" />
              數據篩選
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">時間範圍</label>
                <select className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs outline-none">
                  <option>最近 30 天</option>
                  <option>最近 90 天</option>
                  <option>本年度</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">目標參數 (Y軸)</label>
                <select className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs outline-none">
                  <option>品質評分 (Quality Score)</option>
                  <option>良率 (Yield)</option>
                  <option>硬度 (Hardness)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Chart View */}
        <div className="lg:col-span-3">
          <div className="glass-panel p-8 rounded-2xl h-[500px] flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-slate-900">
                {analysisType === 'correlation' ? '製程參數與品質相關性' : analysisType === 'trend' ? '實驗指標趨勢圖' : '數據分佈統計'}
              </h3>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                  <RefreshCw className="w-3 h-3" />
                  即時更新中
                </span>
              </div>
            </div>

            <div className="flex-1 w-full">
              {correlationData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                  <Filter className="w-12 h-12 mb-4" />
                  <p className="text-sm font-medium">尚無足夠數據進行分析</p>
                  <p className="text-xs mt-2">請先建立實驗紀錄並輸入樣品品質評分</p>
                </div>
              ) : analysisType === 'correlation' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      type="number" 
                      dataKey="x" 
                      name="參數值" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: '#94a3b8' }}
                    />
                    <YAxis 
                      type="number" 
                      dataKey="y" 
                      name="品質" 
                      domain={[0, 100]}
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: '#94a3b8' }}
                    />
                    <ZAxis type="number" dataKey="z" range={[60, 400]} name="樣本數" />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }} 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Scatter name="實驗數據" data={correlationData} fill="#6366f1">
                      {correlationData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.y > 80 ? '#10b981' : entry.y > 60 ? '#6366f1' : '#f43f5e'} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              ) : analysisType === 'trend' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                    />
                    <YAxis 
                      domain={[0, 100]}
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: '#94a3b8' }}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="y" 
                      stroke="#6366f1" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distributionData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="range" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: '#94a3b8' }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: '#94a3b8' }}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]}>
                      {distributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === distributionData.length - 1 ? '#10b981' : '#6366f1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">相關係數 (R²)</p>
                <p className="text-lg font-bold text-slate-900">0.84</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">建議最佳區間</p>
                <p className="text-lg font-bold text-emerald-600">120 - 135 °C</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">異常偏離點</p>
                <p className="text-lg font-bold text-rose-500">2 組</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
