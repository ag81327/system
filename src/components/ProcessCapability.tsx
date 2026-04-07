import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import { Info, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import { TestItem, Experiment, Project } from '../types';
import { generateMockResults } from '../mockData';
import { cn } from '../lib/utils';

interface ProcessCapabilityProps {
  project: Project;
  experiments: Experiment[];
  testItems: TestItem[];
}

export const ProcessCapability = ({ project, experiments, testItems }: ProcessCapabilityProps) => {
  const stats = useMemo(() => {
    const projectExperiments = experiments.filter(e => e.projectId === project.id);
    
    if (projectExperiments.length === 0) return [];

    return testItems.map(item => {
      // Collect all mean values for this test item across all experiments in the project
      const values = projectExperiments.map(exp => {
        const results = generateMockResults(exp.id);
        return results.find(r => r.testItemId === item.id)?.mean || 0;
      }).filter(v => v > 0);

      if (values.length === 0) return null;

      const n = values.length;
      const mean = values.reduce((a, b) => a + b, 0) / n;
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1 || 1);
      const stdDev = Math.sqrt(variance);

      const spec = project.specs?.[item.id];
      const USL = spec?.max;
      const LSL = spec?.min;

      let Cp = 0;
      let Cpk = 0;

      if (USL !== undefined && LSL !== undefined) {
        Cp = (USL - LSL) / (6 * stdDev);
        const CpkUpper = (USL - mean) / (3 * stdDev);
        const CpkLower = (mean - LSL) / (3 * stdDev);
        Cpk = Math.min(CpkUpper, CpkLower);
      } else if (USL !== undefined) {
        Cpk = (USL - mean) / (3 * stdDev);
      } else if (LSL !== undefined) {
        Cpk = (mean - LSL) / (3 * stdDev);
      }

      return {
        id: item.id,
        name: item.name,
        unit: item.unit,
        mean,
        stdDev,
        Cp,
        Cpk,
        USL,
        LSL,
        n
      };
    }).filter(Boolean);
  }, [project.id, project.specs, experiments, testItems]);

  const getStatus = (Cpk: number) => {
    if (Cpk >= 1.33) return { label: '優良', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2 };
    if (Cpk >= 1.0) return { label: '滿意', color: 'text-blue-600', bg: 'bg-blue-50', icon: CheckCircle2 };
    return { label: '不足', color: 'text-rose-600', bg: 'bg-rose-50', icon: AlertCircle };
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">製程能力分析 (Cp / Cpk)</h2>
          <p className="text-sm text-slate-500">評估當前製程是否能穩定生產符合規格的產品。</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <HelpCircle className="w-4 h-4" />
          計算基準：最近 {stats[0]?.n || 0} 個批次
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat: any) => {
          const status = getStatus(stat.Cpk);
          return (
            <div key={stat.id} className="glass-panel p-6 rounded-2xl border border-slate-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900">{stat.name}</h3>
                <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1", status.bg, status.color)}>
                  <status.icon className="w-3 h-3" />
                  {status.label}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cp</p>
                  <p className="text-xl font-bold text-slate-900">{stat.Cp.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cpk</p>
                  <p className={cn("text-xl font-bold", status.color)}>{stat.Cpk.toFixed(2)}</p>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-50">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400 font-medium">平均值 (μ)</span>
                  <span className="text-slate-700 font-bold">{stat.mean.toFixed(2)} {stat.unit}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400 font-medium">標準差 (σ)</span>
                  <span className="text-slate-700 font-bold">{stat.stdDev.toFixed(3)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400 font-medium">規格範圍</span>
                  <span className="text-slate-700 font-bold">{stat.LSL} ~ {stat.USL}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="glass-panel p-8 rounded-2xl">
        <h3 className="text-sm font-bold text-slate-900 mb-6">Cpk 指標對照表</h3>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats} layout="vertical" margin={{ left: 20, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" domain={[0, 2]} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 12, fontWeight: 'bold' }} width={100} />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="Cpk" radius={[0, 4, 4, 0]} barSize={24}>
                {stats.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.Cpk >= 1.33 ? '#10b981' : entry.Cpk >= 1.0 ? '#3b82f6' : '#f43f5e'} />
                ))}
              </Bar>
              <ReferenceLine x={1.33} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'top', value: '優良 (1.33)', fill: '#10b981', fontSize: 10 }} />
              <ReferenceLine x={1.0} stroke="#3b82f6" strokeDasharray="3 3" label={{ position: 'top', value: '滿意 (1.0)', fill: '#3b82f6', fontSize: 10 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex gap-3">
        <Info className="w-5 h-5 text-slate-400 shrink-0" />
        <div className="text-xs text-slate-500 leading-relaxed">
          <p className="font-bold mb-1 text-slate-700">製程能力指標定義：</p>
          <ul className="list-disc list-inside space-y-1">
            <li><span className="font-bold">Cp (Process Capability):</span> 衡量製程的潛在能力，不考慮平均值偏移。</li>
            <li><span className="font-bold">Cpk (Process Capability Index):</span> 衡量製程的實際能力，考慮平均值相對於規格中心的偏移。</li>
            <li><span className="font-bold">Cpk &gt; 1.33:</span> 製程能力優良，品質極其穩定。</li>
            <li><span className="font-bold">1.0 &lt; Cpk &lt; 1.33:</span> 製程能力滿意，但需注意偏移趨勢。</li>
            <li><span className="font-bold">Cpk &lt; 1.0:</span> 製程能力不足，產品有不合格風險，需進行製程改善。</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
