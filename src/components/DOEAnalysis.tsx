import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { DOESession, Experiment, DOEFactor, TestItem, Sample, ProcessConditionType, ProcessParameterMaster } from '../types';
import { getPersistentExperiments, getPersistentSamples, getPersistentTestItems, savePersistentExperiment, getPersistentProcessParameters } from '../lib/persistence';
import { Beaker, TrendingUp, AlertCircle, ChevronRight, Table as TableIcon, Star, CheckCircle2, BarChart3, Target, Info } from 'lucide-react';
import { cn } from '../lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface DOEAnalysisProps {
  session: DOESession;
  onBack: () => void;
}

export const DOEAnalysis: React.FC<DOEAnalysisProps> = ({ session, onBack }) => {
  const { user } = useAuth();
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [testItems, setTestItems] = useState<TestItem[]>([]);
  const [samples, setSamples] = useState<Record<string, Sample[]>>({});
  const [selectedTestItemId, setSelectedTestItemId] = useState<string>('');
  const [processParametersMaster, setProcessParametersMaster] = useState<ProcessParameterMaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [allExps, allItems, allParams] = await Promise.all([
          getPersistentExperiments(),
          getPersistentTestItems(),
          getPersistentProcessParameters()
        ]);

        // Deduplicate test items by name to avoid duplicate metrics in dropdown
        const uniqueItemsMap = new Map<string, TestItem>();
        allItems.forEach(item => {
          if (!uniqueItemsMap.has(item.name)) {
            uniqueItemsMap.set(item.name, item);
          }
        });
        const uniqueItems = Array.from(uniqueItemsMap.values());

        const sessionExps = allExps.filter(e => e.doeSessionId === session.id);
        setExperiments(sessionExps);
        setTestItems(uniqueItems);
        setProcessParametersMaster(allParams);

        if (uniqueItems.length > 0) {
          setSelectedTestItemId(uniqueItems[0].id);
        }

        const samplePromises = sessionExps.map(e => getPersistentSamples(e.id));
        const allSamples = await Promise.all(samplePromises);
        
        const sampleMap: Record<string, Sample[]> = {};
        sessionExps.forEach((e, i) => {
          sampleMap[e.id] = allSamples[i];
        });
        setSamples(sampleMap);
      } catch (error) {
        console.error('Error fetching DOE analysis data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [session.id]);

  const analysisData = useMemo(() => {
    if (!selectedTestItemId || experiments.length === 0) return null;

    // Calculate average result for each experiment
    const expResults = experiments.map(exp => {
      const expSamples = samples[exp.id] || [];
      const results = expSamples.flatMap(s => s.results || []).filter(r => r.testItemId === selectedTestItemId);
      const mean = results.length > 0 ? results.reduce((sum, r) => sum + r.mean, 0) / results.length : null;
      
      return {
        expId: exp.id,
        title: exp.title,
        mean,
        factors: (() => {
          // 1. Try matching by experimentId
          let run = session.matrix.find(m => m.experimentId === exp.id);
          if (run) return run.values;

          // 2. Try matching by matrix ID in title (legacy)
          run = session.matrix.find(m => exp.title.includes(m.id));
          if (run) return run.values;

          // 3. Try matching by "Run X" index in title
          const runMatch = exp.title.match(/Run (\d+)/i);
          if (runMatch) {
            const runIdx = parseInt(runMatch[1]) - 1;
            if (session.matrix[runIdx]) return session.matrix[runIdx].values;
          }

          // 4. Try matching by factor values if they were somehow stored on the experiment (not currently done)
          return {};
        })()
      };
    }).filter(d => d.mean !== null);

    // Calculate main effects and S/N ratios for each factor
    const results = session.factors.map(factor => {
      const levelEffects = factor.levels.map(level => {
        const matchingExps = expResults.filter(d => d.factors[factor.id] === level);
        
        const values = matchingExps.map(e => e.mean || 0);
        const avg = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
        
        // Calculate S/N Ratio
        let snRatio = 0;
        if (values.length > 0) {
          const n = values.length;
          if (session.snRatioType === 'Smaller') {
            // Smaller-the-better: -10 * log10(1/n * sum(y^2))
            const sumSq = values.reduce((sum, y) => sum + (y * y), 0);
            snRatio = -10 * Math.log10(sumSq / n);
          } else if (session.snRatioType === 'Nominal') {
            // Nominal-the-best: 10 * log10(mean^2 / variance)
            const variance = n > 1 ? values.reduce((sum, y) => sum + Math.pow(y - avg, 2), 0) / (n - 1) : 0.0001;
            snRatio = 10 * Math.log10((avg * avg) / variance);
          } else {
            // Larger-the-better: -10 * log10(1/n * sum(1/y^2))
            const sumInvSq = values.reduce((sum, y) => sum + (1 / (y * y || 0.0001)), 0);
            snRatio = -10 * Math.log10(sumInvSq / n);
          }
        }

        return { level, avg, snRatio };
      });

      const avgs = levelEffects.map(le => le.avg);
      const delta = Math.max(...avgs) - Math.min(...avgs);
      
      const snRatios = levelEffects.map(le => le.snRatio);
      const snDelta = Math.max(...snRatios) - Math.min(...snRatios);

      return {
        factorId: factor.id,
        factorName: factor.name,
        effects: levelEffects,
        delta,
        snDelta
      };
    }).sort((a, b) => b.delta - a.delta);

    // ANOVA Calculation (Simplified)
    const overallAvg = expResults.reduce((sum, e) => sum + (e.mean || 0), 0) / expResults.length;
    const totalSS = expResults.reduce((sum, e) => sum + Math.pow((e.mean || 0) - overallAvg, 2), 0);
    
    const anova = results.map(r => {
      let factorSS = 0;
      r.effects.forEach(eff => {
        const count = expResults.filter(e => e.factors[r.factorId] === eff.level).length;
        factorSS += count * Math.pow(eff.avg - overallAvg, 2);
      });
      const contribution = totalSS > 0 ? (factorSS / totalSS) * 100 : 0;
      return {
        name: r.factorName,
        ss: factorSS,
        contribution
      };
    });

    // Best Combination Prediction
    const bestCombination = session.factors.map(f => {
      const factorResult = results.find(r => r.factorId === f.id);
      if (!factorResult) return { factorId: f.id, factorName: f.name, bestLevel: f.levels[0] };
      
      // Pick best level based on SN ratio or Avg
      const bestLevelData = [...factorResult.effects].sort((a, b) => b.snRatio - a.snRatio)[0];
      return {
        factorId: f.id,
        factorName: f.name,
        bestLevel: bestLevelData?.level || f.levels[0],
        avg: bestLevelData?.avg,
        snRatio: bestLevelData?.snRatio
      };
    });

    // Predicted Result
    const predictedAvg = overallAvg + bestCombination.reduce((sum, b) => {
      const factorResult = results.find(r => r.factorId === b.factorId);
      const levelAvg = factorResult?.effects.find(e => e.level === b.bestLevel)?.avg || overallAvg;
      return sum + (levelAvg - overallAvg);
    }, 0);

    return {
      mainEffects: results,
      anova,
      bestCombination,
      predictedAvg,
      overallAvg
    };
  }, [selectedTestItemId, experiments, samples, session]);

  const handleCreateConfirmation = useCallback(async () => {
    console.log('handleCreateConfirmation triggered', { hasAnalysisData: !!analysisData, isGenerating });
    
    if (!analysisData) {
      toast.error('分析數據尚未準備就緒，請稍後再試');
      return;
    }

    if (isGenerating) return;

    setIsGenerating(true);
    const toastId = toast.loading('正在生成驗證實驗...');

    try {
      const safeUuid = () => {
        try {
          return uuidv4();
        } catch (e) {
          return `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
      };

      const exp: Experiment = {
        id: safeUuid(),
        projectId: session.projectId,
        title: `驗證實驗: ${session.name} (最佳組合)`,
        date: new Date().toISOString().split('T')[0],
        operator: user?.name || '系統管理員',
        status: 'Draft',
        doeSessionId: session.id,
        processConditions: analysisData.bestCombination.map(b => {
          const factor = session.factors.find(f => f.id === b.factorId);
          
          // Find matching master data for category and unit
          const masterParam = processParametersMaster.find(p => p.name === b.factorName);
          
          let conditionType: ProcessConditionType = masterParam?.category || 'Other';
          
          // Fallback heuristic if not found in master data
          if (conditionType === 'Other' && factor?.type === 'Numerical') {
            const name = factor.name.toLowerCase();
            if (name.includes('溫度') || name.includes('temp')) conditionType = 'Temperature';
            else if (name.includes('壓力') || name.includes('press')) conditionType = 'Pressure';
            else if (name.includes('時間') || name.includes('time')) conditionType = 'Time';
            else if (name.includes('能量') || name.includes('energy')) conditionType = 'Energy';
            else if (name.includes('濃度') || name.includes('conc')) conditionType = 'Concentration';
          }
          
          return {
            id: safeUuid(),
            name: b.factorName,
            type: conditionType,
            value: parseFloat(b.bestLevel) || 0,
            unit: masterParam?.unit || factor?.unit || '',
          };
        }),
        formulation: [],
        observations: '此為系統預測之最佳組合驗證實驗。',
        anomalies: '',
        conclusions: '',
        suggestions: ''
      };

      console.log('Generating experiment:', exp);
      await savePersistentExperiment(exp);
      toast.success('驗證實驗草稿已生成，請至實驗紀錄查看', { id: toastId });
    } catch (error) {
      console.error('Error generating verification experiment:', error);
      toast.error(`生成失敗: ${error instanceof Error ? error.message : '未知錯誤'}`, { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  }, [analysisData, isGenerating, session, user, processParametersMaster]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  const selectedTestItem = testItems.find(t => t.id === selectedTestItemId);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">DOE 實驗分析: {session.name}</h2>
          <p className="text-sm text-slate-500">分析各因子對實驗結果的影響程度。</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">分析指標:</span>
            <select 
              value={selectedTestItemId}
              onChange={(e) => setSelectedTestItemId(e.target.value)}
              className="text-sm font-bold text-slate-700 outline-none bg-transparent"
            >
              {testItems.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={onBack}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            返回列表
          </button>
        </div>
      </div>

      {!analysisData ? (
        <div className="glass-panel p-12 text-center rounded-2xl border-2 border-dashed border-slate-100">
          <Beaker className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900 mb-2">尚未開始實驗</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            請先在「實驗記錄」中完成此 DOE 計畫生成的實驗草稿，並輸入量測數據。
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Header Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass-panel p-6 rounded-2xl border-l-4 border-brand-500 bg-white">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">分析目標 (S/N)</div>
              <div className="text-xl font-bold text-slate-900">
                {session.snRatioType === 'Larger' ? '望大 (越高越好)' : 
                 session.snRatioType === 'Smaller' ? '望小 (越低越好)' : '望目 (目標值)'}
              </div>
            </div>
            <div className="glass-panel p-6 rounded-2xl bg-white">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">實驗設計 / 重複</div>
              <div className="text-xl font-bold text-slate-900">{session.designMethod} / {session.replications}x</div>
            </div>
            <div className="glass-panel p-6 rounded-2xl bg-white">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">總平均值 (Grand Mean)</div>
              <div className="text-xl font-bold text-brand-600 font-mono">{analysisData.overallAvg.toFixed(3)}</div>
            </div>
            <div className="glass-panel p-6 rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-200">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">預測最佳值 (Predicted)</div>
              <div className="text-xl font-bold text-brand-400 font-mono">{analysisData.predictedAvg.toFixed(3)}</div>
            </div>
          </div>

          {/* Prediction & Best Combination */}
          <div className="glass-panel p-8 rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative">
            <div className="absolute bottom-0 right-0 p-8 opacity-5 pointer-events-none">
              <Star className="w-32 h-32" />
            </div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Target className="w-6 h-6 text-brand-500" />
                  最佳參數組合預測 (Optimal Prediction)
                </h3>
                <p className="text-sm text-slate-500 mt-1">基於 S/N 比與主效應分析推導出的理論最佳設定</p>
              </div>
              <button 
                onClick={handleCreateConfirmation}
                disabled={isGenerating}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg z-10",
                  isGenerating 
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none" 
                    : "bg-brand-500 text-white hover:bg-brand-600 shadow-brand-200"
                )}
              >
                {isGenerating ? (
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin"></div>
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {isGenerating ? '正在生成...' : '生成驗證實驗'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {analysisData.bestCombination.map((best, idx) => (
                <div key={best.factorId} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{best.factorName}</div>
                  <div className="text-lg font-bold text-slate-900">{best.bestLevel}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded font-bold">
                      SN: {best.snRatio?.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Effects Charts */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-brand-500" />
                  因子主效應圖 (Main Effects Plot)
                </h3>
              </div>
              
              {analysisData.mainEffects.map((factorData) => (
                <div key={factorData.factorId} className="glass-panel p-8 rounded-2xl shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex flex-col">
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-brand-500" />
                        {factorData.factorName}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Delta (Avg): {factorData.delta.toFixed(3)}</span>
                        <span className="text-[10px] text-brand-500 font-bold uppercase">Delta (SN): {factorData.snDelta.toFixed(3)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="text-[10px] font-bold px-2 py-1 rounded bg-slate-100 text-slate-600">平均值</button>
                      <button className="text-[10px] font-bold px-2 py-1 rounded bg-brand-50 text-brand-600">S/N 比</button>
                    </div>
                  </div>

                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={factorData.effects}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis 
                          dataKey="level" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                        />
                        <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="avg" 
                          name="平均值"
                          stroke="#0ea5e9" 
                          strokeWidth={3}
                          dot={{ r: 6, fill: '#0ea5e9', strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 8, strokeWidth: 0 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="snRatio" 
                          name="S/N 比"
                          stroke="#f59e0b" 
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={{ r: 4, fill: '#f59e0b' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>

            {/* ANOVA & Contribution */}
            <div className="space-y-6">
              <div className="glass-panel p-8 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6">
                  <Star className="w-5 h-5 text-brand-500" />
                  因子貢獻度 (ANOVA Summary)
                </h3>
                
                <div className="space-y-6">
                  {analysisData.anova.map((item) => (
                    <div key={item.name} className="space-y-2">
                      <div className="flex justify-between items-end">
                        <span className="text-sm font-bold text-slate-700">{item.name}</span>
                        <span className="text-xs font-bold text-brand-600">{item.contribution.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-brand-500 rounded-full transition-all duration-1000"
                          style={{ width: `${item.contribution}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-slate-400 mt-0.5" />
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      貢獻度百分比代表該因子對實驗結果變異的影響程度。百分比越高，代表該因子越關鍵。
                    </p>
                  </div>
                </div>
              </div>

              {/* Radar Chart for Multi-Metric */}
              <div className="glass-panel p-8 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6">
                  <Target className="w-5 h-5 text-brand-500" />
                  綜合性能評估
                </h3>
                <div className="h-[250px] flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={analysisData.anova}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} />
                      <Radar
                        name="貢獻度"
                        dataKey="contribution"
                        stroke="#0ea5e9"
                        fill="#0ea5e9"
                        fillOpacity={0.5}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Table Summary */}
      <div className="glass-panel p-8 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <TableIcon className="w-5 h-5 text-brand-500" />
          實驗數據摘要
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">實驗標題</th>
                {session.factors.map(f => (
                  <th key={f.id} className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{f.name}</th>
                ))}
                <th className="px-6 py-4 text-[10px] font-bold text-brand-600 uppercase tracking-wider text-right">{selectedTestItem?.name} 平均值</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {experiments.map(exp => {
                const expSamples = samples[exp.id] || [];
                const results = expSamples.flatMap(s => s.results || []).filter(r => r.testItemId === selectedTestItemId);
                const mean = results.length > 0 ? results.reduce((sum, r) => sum + r.mean, 0) / results.length : null;
                
                // Find factors from matrix
                const run = session.matrix.find(m => exp.title.includes(m.id)) || session.matrix[0]; // Fallback

                return (
                  <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{exp.title}</td>
                    {session.factors.map(f => (
                      <td key={f.id} className="px-6 py-4 text-xs text-slate-600">
                        {run?.values[f.id] || '-'}
                      </td>
                    ))}
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-bold text-brand-600">
                        {mean !== null ? mean.toFixed(2) : '無數據'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
