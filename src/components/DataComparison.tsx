import React, { useState, useEffect, useMemo } from 'react';
import { useComparison } from './ComparisonContext';
import { Experiment, Sample, TestResult, TestItem } from '../types';
import { getPersistentSamples, getPersistentTestItems } from '../lib/persistence';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar 
} from 'recharts';
import { 
  ArrowLeft, 
  LayoutGrid, 
  Table as TableIcon, 
  TrendingUp, 
  X, 
  Trash2, 
  Filter, 
  ChevronDown, 
  ChevronUp,
  AlertCircle,
  Download
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export const DataComparison: React.FC = () => {
  const navigate = useNavigate();
  const { selectedExperiments, removeFromComparison, clearComparison } = useComparison();
  const [samples, setSamples] = useState<Record<string, Sample[]>>({});
  const [testItems, setTestItems] = useState<TestItem[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'charts'>('table');
  const [hideIdentical, setHideIdentical] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [allTestItems] = await Promise.all([
          getPersistentTestItems()
        ]);

        const experimentSamples: Record<string, Sample[]> = {};
        await Promise.all(selectedExperiments.map(async (exp) => {
          const expSamples = await getPersistentSamples(exp.id);
          experimentSamples[exp.id] = expSamples;
        }));

        setSamples(experimentSamples);
        setTestItems(allTestItems);
      } catch (error) {
        console.error('Failed to fetch comparison data', error);
        toast.error('讀取比對數據失敗');
      } finally {
        setIsLoading(false);
      }
    };

    if (selectedExperiments.length > 0) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [selectedExperiments]);

  if (selectedExperiments.length === 0) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <LayoutGrid className="w-16 h-16 mb-4 opacity-20" />
        <p className="text-lg font-medium">尚未選擇任何實驗進行比對</p>
        <button 
          onClick={() => navigate('/experiments')}
          className="mt-4 px-6 py-2 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all"
        >
          前往實驗清單挑選
        </button>
      </div>
    );
  }

  // Helper to get mean result for a test item across all samples of an experiment
  // Grouping by name to handle "same name" items
  const getExperimentMeanByName = (expId: string, testItemName: string) => {
    const expSamples = samples[expId] || [];
    // Find all test items with this name in this experiment
    const relevantItemIds = testItems.filter(ti => ti.name === testItemName).map(ti => ti.id);
    const results = expSamples.flatMap(s => s.results || []).filter(r => relevantItemIds.includes(r.testItemId));
    if (results.length === 0) return null;
    const sum = results.reduce((acc, r) => acc + r.mean, 0);
    return Number((sum / results.length).toFixed(2));
  };

  const getDefectStats = (expId: string) => {
    const expSamples = samples[expId] || [];
    const totalA = expSamples.reduce((sum, s) => sum + (s.gradeA || 0), 0);
    const totalB = expSamples.reduce((sum, s) => sum + (s.gradeB || 0), 0);
    const totalC = expSamples.reduce((sum, s) => sum + (s.gradeC || 0), 0);
    const total = totalA + totalB + totalC;
    return { 
      totalA, 
      totalB, 
      totalC, 
      total, 
      yieldA: total > 0 ? ((totalA / total) * 100).toFixed(1) + '%' : '-',
      yieldAB: total > 0 ? (((totalA + totalB) / total) * 100).toFixed(1) + '%' : '-'
    };
  };

  // Helper to check if a row has different values across experiments
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      
      // Prepare data for Excel
      const data: any[][] = [];
      
      // Header row
      const header = ['比對項目', ...comparisonColumns.map(col => `${col.experiment.title} - ${col.sample?.sampleCode || '無樣品'}`)];
      data.push(header);
      
      // Basic Info
      data.push(['基本資訊']);
      data.push(['操作人員', ...comparisonColumns.map(col => col.experiment.operator)]);
      data.push(['樣品名稱', ...comparisonColumns.map(col => col.sample?.sampleCode || '-')]);
      data.push(['批次', ...comparisonColumns.map(col => col.sample?.batchNumber || '-')]);
      
      // Formulation
      data.push(['材料配比']);
      const allMaterials = Array.from(new Set(selectedExperiments.flatMap(exp => exp.formulation?.map(f => f.materialName) || [])));
      allMaterials.forEach(matName => {
        const row = [matName];
        comparisonColumns.forEach(col => {
          const item = col.experiment.formulation?.find(f => f.materialName === matName);
          row.push(item ? `${item.theoreticalWeight} / ${item.actualWeight || 0} ${item.unit}` : '-');
        });
        data.push(row);
      });
      
      // Process Conditions
      data.push(['製程條件']);
      const allConditions = Array.from(new Set(selectedExperiments.flatMap(exp => exp.processConditions?.map(c => c.name) || [])));
      allConditions.forEach(condName => {
        const row = [condName];
        comparisonColumns.forEach(col => {
          const cond = col.experiment.processConditions?.find(c => c.name === condName);
          row.push(cond ? `${cond.value} ${cond.unit}` : '-');
        });
        data.push(row);
      });
      
      // Test Results
      data.push(['測試結果']);
      const uniqueNames = Array.from(new Set(testItems.map(ti => ti.name)));
      uniqueNames.forEach(itemName => {
        const item = testItems.find(ti => ti.name === itemName);
        const row: (string | number)[] = [`${itemName} (${item?.unit || ''})`];
        comparisonColumns.forEach(col => {
          if (!col.sample) {
            row.push('-');
            return;
          }
          const relevantItemIds = testItems.filter(ti => ti.name === itemName).map(ti => ti.id);
          const result = col.sample.results?.find(r => relevantItemIds.includes(r.testItemId));
          row.push(result ? result.mean : '-');
        });
        data.push(row);
      });
      
      // Stats
      data.push(['其他統計']);
      data.push(['模具批號', ...comparisonColumns.map(col => col.sample?.moldBatchNumber || '-')]);
      data.push(['良率 (A級占比)', ...comparisonColumns.map(col => getSampleDefectStats(col.sample).yieldA)]);
      data.push(['良率 (A+B級占比)', ...comparisonColumns.map(col => getSampleDefectStats(col.sample).yieldAB)]);
      
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "數據比對表");
      
      XLSX.writeFile(wb, `數據比對表_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel 匯出成功');
    } catch (error) {
      console.error('Excel export failed:', error);
      toast.error('匯出失敗');
    }
  };

  const comparisonColumns = useMemo(() => {
    return selectedExperiments.flatMap(exp => {
      const expSamples = samples[exp.id] || [];
      if (expSamples.length === 0) {
        return [{
          experiment: exp,
          sample: null as Sample | null,
          id: `${exp.id}-no-sample`
        }];
      }
      return expSamples.map(s => ({
        experiment: exp,
        sample: s as Sample | null,
        id: `${exp.id}-${s.id}`
      }));
    });
  }, [selectedExperiments, samples]);

  const getSampleDefectStats = (sample: Sample | null) => {
    if (!sample) return { yieldA: '-', yieldAB: '-', totalA: 0, totalB: 0, totalC: 0, total: 0 };
    const totalA = sample.gradeA || 0;
    const totalB = sample.gradeB || 0;
    const totalC = sample.gradeC || 0;
    const total = totalA + totalB + totalC;
    return { 
      totalA, 
      totalB, 
      totalC, 
      total, 
      yieldA: total > 0 ? ((totalA / total) * 100).toFixed(1) + '%' : '-',
      yieldAB: total > 0 ? (((totalA + totalB) / total) * 100).toFixed(1) + '%' : '-'
    };
  };

  const isDifferent = (values: any[]) => {
    if (values.length <= 1) return false;
    const first = values[0];
    return values.some(v => JSON.stringify(v) !== JSON.stringify(first));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">數據比對分析</h1>
            <p className="text-sm text-slate-500">正在比對 {selectedExperiments.length} 筆實驗紀錄</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex">
            <button 
              onClick={() => setViewMode('table')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
                viewMode === 'table' ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <TableIcon className="w-4 h-4" />
              對比表
            </button>
            <button 
              onClick={() => setViewMode('charts')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
                viewMode === 'charts' ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <TrendingUp className="w-4 h-4" />
              趨勢圖
            </button>
          </div>
          <button 
            onClick={clearComparison}
            className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
            title="清空對比籃"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
        </div>
      ) : (
        <>
          {viewMode === 'table' ? (
            <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={hideIdentical}
                      onChange={(e) => setHideIdentical(e.target.checked)}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    隱藏相同參數
                  </label>
                </div>
                <button 
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 text-xs font-bold text-brand-600 hover:bg-brand-50 px-3 py-1.5 rounded-lg transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  匯出比對表
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 sticky left-0 bg-slate-50 z-10 w-48">比對項目</th>
                      {comparisonColumns.map(col => (
                        <th key={col.id} className="p-4 border-b border-slate-200 min-w-[200px]">
                          <div className="flex items-center justify-between group">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">{col.experiment.title}</p>
                              <p className="text-[10px] text-brand-600 font-bold mt-0.5">
                                {col.sample ? `${col.sample.sampleCode} (${col.sample.batchNumber})` : '無樣品'}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{col.experiment.date}</p>
                            </div>
                            <button 
                              onClick={() => removeFromComparison(col.experiment.id)}
                              className="p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* Basic Info Section */}
                    <tr className="bg-slate-50/30">
                      <td colSpan={comparisonColumns.length + 1} className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">基本資訊</td>
                    </tr>
                    <tr>
                      <td className="p-4 text-sm font-medium text-slate-600 sticky left-0 bg-white z-10 border-r border-slate-50">操作人員</td>
                      {comparisonColumns.map(col => (
                        <td key={col.id} className="p-4 text-sm text-slate-700">{col.experiment.operator}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-4 text-sm font-medium text-slate-600 sticky left-0 bg-white z-10 border-r border-slate-50">樣品名稱</td>
                      {comparisonColumns.map(col => (
                        <td key={col.id} className="p-4 text-sm font-bold text-brand-600">{col.sample?.sampleCode || '-'}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-4 text-sm font-medium text-slate-600 sticky left-0 bg-white z-10 border-r border-slate-50">批次</td>
                      {comparisonColumns.map(col => (
                        <td key={col.id} className="p-4 text-sm text-slate-700">{col.sample?.batchNumber || '-'}</td>
                      ))}
                    </tr>

                    {/* Formulation Section */}
                    <tr className="bg-slate-50/30">
                      <td colSpan={comparisonColumns.length + 1} className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">材料配比</td>
                    </tr>
                    {/* Get all unique material names across selected experiments */}
                    {Array.from(new Set(selectedExperiments.flatMap(exp => exp.formulation?.map(f => f.materialName) || []))).map(matName => {
                      const values = comparisonColumns.map(col => {
                        const item = col.experiment.formulation?.find(f => f.materialName === matName);
                        return item ? `${item.theoreticalWeight} / ${item.actualWeight || 0} ${item.unit}` : '-';
                      });
                      
                      if (hideIdentical && !isDifferent(values)) return null;

                      return (
                        <tr key={matName} className={cn(isDifferent(values) && "bg-amber-50/30")}>
                          <td className="p-4 text-sm font-medium text-slate-600 sticky left-0 bg-white z-10 border-r border-slate-50">
                            {matName}
                            <span className="block text-[10px] text-slate-400">理論 / 實際</span>
                            {isDifferent(values) && <span className="ml-2 text-[10px] text-amber-600 font-bold bg-amber-100 px-1 rounded">變因</span>}
                          </td>
                          {values.map((val, idx) => (
                            <td key={idx} className="p-4 text-sm text-slate-700">{val}</td>
                          ))}
                        </tr>
                      );
                    })}

                    {/* Process Conditions Section */}
                    <tr className="bg-slate-50/30">
                      <td colSpan={comparisonColumns.length + 1} className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">製程條件</td>
                    </tr>
                    {Array.from(new Set(selectedExperiments.flatMap(exp => exp.processConditions?.map(c => c.name) || []))).map(condName => {
                      const values = comparisonColumns.map(col => {
                        const cond = col.experiment.processConditions?.find(c => c.name === condName);
                        return cond ? `${cond.value} ${cond.unit}` : '-';
                      });

                      if (hideIdentical && !isDifferent(values)) return null;

                      return (
                        <tr key={condName} className={cn(isDifferent(values) && "bg-amber-50/30")}>
                          <td className="p-4 text-sm font-medium text-slate-600 sticky left-0 bg-white z-10 border-r border-slate-50">
                            {condName}
                            {isDifferent(values) && <span className="ml-2 text-[10px] text-amber-600 font-bold bg-amber-100 px-1 rounded">變因</span>}
                          </td>
                          {values.map((val, idx) => (
                            <td key={idx} className="p-4 text-sm text-slate-700">{val}</td>
                          ))}
                        </tr>
                      );
                    })}

                    {/* Test Results Section */}
                    <tr className="bg-slate-50/30">
                      <td colSpan={comparisonColumns.length + 1} className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">測試結果</td>
                    </tr>
                    {Array.from(new Set(testItems.map(ti => ti.name))).map(itemName => {
                      const item = testItems.find(ti => ti.name === itemName);
                      const values = comparisonColumns.map(col => {
                        if (!col.sample) return null;
                        const relevantItemIds = testItems.filter(ti => ti.name === itemName).map(ti => ti.id);
                        return col.sample.results?.find(r => relevantItemIds.includes(r.testItemId)) || null;
                      });
                      
                      return (
                        <tr key={itemName}>
                          <td className="p-4 text-sm font-medium text-slate-600 sticky left-0 bg-white z-10 border-r border-slate-50">
                            {itemName}
                            <span className="ml-1 text-[10px] text-slate-400">({item?.unit})</span>
                          </td>
                          {values.map((res, idx) => (
                            <td key={idx} className="p-4 text-sm text-slate-700">
                              {res ? (
                                <div>
                                  <p className="font-bold text-slate-900">{res.mean.toFixed(2)}</p>
                                  <p className="text-[10px] text-slate-400">SD: {res.stdDev.toFixed(2)}</p>
                                </div>
                              ) : (
                                <span className="text-slate-300 italic text-xs">無數據</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}

                    {/* Additional Stats Section */}
                    <tr className="bg-slate-50/30">
                      <td colSpan={comparisonColumns.length + 1} className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">其他統計與模具</td>
                    </tr>
                    <tr>
                      <td className="p-4 text-sm font-medium text-slate-600 sticky left-0 bg-white z-10 border-r border-slate-50">模具批號</td>
                      {comparisonColumns.map(col => (
                        <td key={col.id} className="p-4 text-sm text-slate-700">
                          {col.sample?.moldBatchNumber || '-'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-4 text-sm font-medium text-slate-600 sticky left-0 bg-white z-10 border-r border-slate-50">良率 (A級占比)</td>
                      {comparisonColumns.map(col => {
                        const stats = getSampleDefectStats(col.sample);
                        return (
                          <td key={col.id} className="p-4 text-sm font-bold text-emerald-600">{stats.yieldA}</td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="p-4 text-sm font-medium text-slate-600 sticky left-0 bg-white z-10 border-r border-slate-50">良率 (A+B級占比)</td>
                      {comparisonColumns.map(col => {
                        const stats = getSampleDefectStats(col.sample);
                        return (
                          <td key={col.id} className="p-4 text-sm font-bold text-blue-600">{stats.yieldAB}</td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="p-4 text-sm font-medium text-slate-600 sticky left-0 bg-white z-10 border-r border-slate-50">缺陷統計 (A/B/C)</td>
                      {comparisonColumns.map(col => {
                        const stats = getSampleDefectStats(col.sample);
                        return (
                          <td key={col.id} className="p-4 text-sm text-slate-700">
                            {stats.totalA} / {stats.totalB} / {stats.totalC}
                          </td>
                        );
                      })}
                    </tr>
                    {/* Defect Types Breakdown */}
                    {Array.from(new Set(selectedExperiments.flatMap(exp => 
                      samples[exp.id]?.flatMap(s => s.defects?.map(d => d.type) || []) || []
                    ))).map(defectType => {
                      const values = comparisonColumns.map(col => {
                        const d = col.sample?.defects?.find(def => def.type === defectType);
                        return d?.count || 0;
                      });

                      return (
                        <tr key={defectType}>
                          <td className="p-4 text-sm font-medium text-slate-600 sticky left-0 bg-white z-10 border-r border-slate-50">
                            缺陷: {defectType}
                          </td>
                          {values.map((val, idx) => (
                            <td key={idx} className="p-4 text-sm text-slate-700">{val}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Defect Yield Chart */}
              <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 mb-6">良率與缺陷分佈對比</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={selectedExperiments.map(exp => {
                      const stats = getDefectStats(exp.id);
                      return {
                        name: exp.title.length > 10 ? exp.title.substring(0, 10) + '...' : exp.title,
                        A級: stats.totalA,
                        B級: stats.totalB,
                        C級: stats.totalC
                      };
                    })}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Legend />
                      <Bar dataKey="A級" fill="#10b981" stackId="a" />
                      <Bar dataKey="B級" fill="#f59e0b" stackId="a" />
                      <Bar dataKey="C級" fill="#f43f5e" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {Array.from(new Set(testItems.map(ti => ti.name))).map(itemName => {
                const item = testItems.find(ti => ti.name === itemName);
                const chartData = selectedExperiments.map(exp => ({
                  name: exp.title.length > 10 ? exp.title.substring(0, 10) + '...' : exp.title,
                  fullName: exp.title,
                  value: getExperimentMeanByName(exp.id, itemName)
                })).filter(d => d.value !== null);

                if (chartData.length === 0) return null;

                return (
                  <div key={itemName} className="glass-panel p-6 rounded-2xl border border-slate-200">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-bold text-slate-900">{itemName} 趨勢對比</h3>
                      <span className="text-xs text-slate-400">單位: {item?.unit}</span>
                    </div>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fill: '#64748b' }} 
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fill: '#64748b' }} 
                          />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            formatter={(value: number) => [`${value} ${item?.unit}`, itemName]}
                            labelFormatter={(label, payload) => payload[0]?.payload?.fullName || label}
                          />
                          <Bar 
                            dataKey="value" 
                            fill="#0ea5e9" 
                            radius={[4, 4, 0, 0]} 
                            barSize={40}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })}
              
              {/* Radar Chart for overall performance comparison */}
              <div className="lg:col-span-2 glass-panel p-8 rounded-2xl border border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 mb-8">綜合性能雷達圖</h3>
                <div className="h-96 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={
                      Array.from(new Set(testItems.map(ti => ti.name))).map(itemName => {
                        const row: any = { subject: itemName, fullMark: 100 };
                        selectedExperiments.forEach(exp => {
                          const val = getExperimentMeanByName(exp.id, itemName);
                          // Normalize value for radar chart if needed, but for now just use raw
                          row[exp.title] = val;
                        });
                        return row;
                      })
                    }>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      {selectedExperiments.map((exp, idx) => (
                        <Radar
                          key={exp.id}
                          name={exp.title}
                          dataKey={exp.title}
                          stroke={['#0ea5e9', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6'][idx % 5]}
                          fill={['#0ea5e9', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6'][idx % 5]}
                          fillOpacity={0.2}
                        />
                      ))}
                      <Legend />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
