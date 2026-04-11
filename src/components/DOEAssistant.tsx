import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Play, Table as TableIcon, Save, ChevronRight, Settings2, X, Info } from 'lucide-react';
import { DOEFactor, DOESession, DOERun, Experiment, ProcessParameterMaster } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { savePersistentExperiment, getPersistentProcessParameters } from '../lib/persistence';
import { useAuth } from './AuthContext';

interface DOEAssistantProps {
  projectId: string;
  onSave: (session: DOESession) => void;
}

export const DOEAssistant: React.FC<DOEAssistantProps> = ({ projectId, onSave }) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [factors, setFactors] = useState<DOEFactor[]>([]);
  const [matrix, setMatrix] = useState<DOERun[]>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [processParams, setProcessParams] = useState<ProcessParameterMaster[]>([]);
  const [designType, setDesignType] = useState<'FullFactorial' | 'L4' | 'L8' | 'L9' | 'L12' | 'L18'>('FullFactorial');
  const [replications, setReplications] = useState(1);
  const [randomized, setRandomized] = useState(true);
  const [snRatioType, setSnRatioType] = useState<'Smaller' | 'Larger' | 'Nominal'>('Larger');

  useEffect(() => {
    const fetchParams = async () => {
      const params = await getPersistentProcessParameters();
      setProcessParams(params);
    };
    fetchParams();
  }, []);

  const addFactor = () => {
    const newFactor: DOEFactor = {
      id: uuidv4(),
      name: `因子 ${factors.length + 1}`,
      type: 'Numerical',
      levels: ['水準 1', '水準 2']
    };
    setFactors([...factors, newFactor]);
  };

  const removeFactor = (id: string) => {
    setFactors(factors.filter(f => f.id !== id));
  };

  const updateFactor = (id: string, field: keyof DOEFactor, value: any) => {
    setFactors(factors.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const addLevel = (factorId: string) => {
    setFactors(factors.map(f => {
      if (f.id === factorId) {
        return { ...f, levels: [...f.levels, `水準 ${f.levels.length + 1}`] };
      }
      return f;
    }));
  };

  const removeLevel = (factorId: string, index: number) => {
    setFactors(factors.map(f => {
      if (f.id === factorId) {
        const newLevels = [...f.levels];
        newLevels.splice(index, 1);
        return { ...f, levels: newLevels };
      }
      return f;
    }));
  };

  const updateLevel = (factorId: string, index: number, value: string) => {
    setFactors(factors.map(f => {
      if (f.id === factorId) {
        const newLevels = [...f.levels];
        newLevels[index] = value;
        return { ...f, levels: newLevels };
      }
      return f;
    }));
  };

  const generateFullFactorial = () => {
    if (factors.length === 0) {
      toast.error('請至少新增一個因子');
      return;
    }

    // Cartesian product of levels
    const cartesian = (...a: any[]) => a.reduce((a, b) => a.flatMap((d: any) => b.map((e: any) => [d, e].flat())));
    
    const levelArrays = factors.map(f => f.levels);
    const combinations = factors.length === 1 ? levelArrays[0].map(l => [l]) : cartesian(...levelArrays);

    const newMatrix: DOERun[] = combinations.map((combo: string[]) => {
      const values: Record<string, string> = {};
      factors.forEach((f, i) => {
        values[f.id] = combo[i];
      });
      return {
        id: uuidv4(),
        values
      };
    });

    setMatrix(newMatrix);
    setStep(2);
    toast.success(`成功生成 ${newMatrix.length} 組實驗組合`);
  };

  const generateTaguchi = (type: 'L4' | 'L8' | 'L9' | 'L12' | 'L18') => {
    if (factors.length === 0) {
      toast.error('請至少新增一個因子');
      return;
    }

    if (type === 'L12') {
      generateL12();
      return;
    }

    if (type === 'L18') {
      generateL18();
      return;
    }

    let combinations: string[][] = [];
    
    if (type === 'L4') {
      // L4(2^3) - 2 levels, up to 3 factors
      if (factors.some(f => f.levels.length !== 2)) {
        toast.error('L4 正交表僅支援 2 水準因子');
        return;
      }
      combinations = [
        [factors[0].levels[0], factors[1]?.levels[0] || '', factors[2]?.levels[0] || ''],
        [factors[0].levels[0], factors[1]?.levels[1] || '', factors[2]?.levels[1] || ''],
        [factors[0].levels[1], factors[1]?.levels[0] || '', factors[2]?.levels[1] || ''],
        [factors[0].levels[1], factors[1]?.levels[1] || '', factors[2]?.levels[0] || ''],
      ];
    } else if (type === 'L9') {
      // L9(3^4) - 3 levels, up to 4 factors
      if (factors.some(f => f.levels.length !== 3)) {
        toast.error('L9 正交表僅支援 3 水準因子');
        return;
      }
      combinations = [
        [factors[0].levels[0], factors[1]?.levels[0] || '', factors[2]?.levels[0] || '', factors[3]?.levels[0] || ''],
        [factors[0].levels[0], factors[1]?.levels[1] || '', factors[2]?.levels[1] || '', factors[3]?.levels[1] || ''],
        [factors[0].levels[0], factors[1]?.levels[2] || '', factors[2]?.levels[2] || '', factors[3]?.levels[2] || ''],
        [factors[0].levels[1], factors[1]?.levels[0] || '', factors[2]?.levels[1] || '', factors[3]?.levels[2] || ''],
        [factors[0].levels[1], factors[1]?.levels[1] || '', factors[2]?.levels[2] || '', factors[3]?.levels[0] || ''],
        [factors[0].levels[1], factors[1]?.levels[2] || '', factors[2]?.levels[0] || '', factors[3]?.levels[1] || ''],
        [factors[0].levels[2], factors[1]?.levels[0] || '', factors[2]?.levels[2] || '', factors[3]?.levels[1] || ''],
        [factors[0].levels[2], factors[1]?.levels[1] || '', factors[2]?.levels[0] || '', factors[3]?.levels[2] || ''],
        [factors[0].levels[2], factors[1]?.levels[2] || '', factors[2]?.levels[1] || '', factors[3]?.levels[0] || ''],
      ];
    } else {
      toast.error('目前尚不支援此設計法');
      return;
    }

    let finalMatrix: DOERun[] = combinations.map((combo) => {
      const values: Record<string, string> = {};
      factors.forEach((f, i) => {
        values[f.id] = combo[i];
      });
      return {
        id: uuidv4(),
        values
      };
    });

    // Handle Replications
    if (replications > 1) {
      const replicatedMatrix: DOERun[] = [];
      finalMatrix.forEach(run => {
        for (let i = 0; i < replications; i++) {
          replicatedMatrix.push({
            ...run,
            id: uuidv4(),
            isReplication: i > 0,
            originalRunId: run.id
          });
        }
      });
      finalMatrix = replicatedMatrix;
    }

    // Handle Randomization
    if (randomized) {
      finalMatrix = [...finalMatrix].sort(() => Math.random() - 0.5);
    }

    // Assign Run Order
    finalMatrix = finalMatrix.map((run, idx) => ({
      ...run,
      runOrder: idx + 1
    }));

    setMatrix(finalMatrix);
    setStep(2);
    toast.success(`成功生成 ${finalMatrix.length} 組實驗組合 (${type})`);
  };

  const generateL12 = () => {
    // L12(2^11) - 2 levels, up to 11 factors
    if (factors.some(f => f.levels.length !== 2)) {
      toast.error('L12 正交表僅支援 2 水準因子');
      return;
    }
    // Simplified L12 logic for demonstration (standard Plackett-Burman)
    const base = [
      [1,1,-1,1,1,1,-1,-1,-1,1,-1],
      [1,-1,1,1,1,-1,-1,-1,1,-1,1],
      [-1,1,1,1,-1,-1,-1,1,-1,1,1],
      [1,1,1,-1,-1,-1,1,-1,1,1,-1],
      [1,1,-1,-1,-1,1,-1,1,1,-1,1],
      [1,-1,-1,-1,1,-1,1,1,-1,1,1],
      [-1,-1,-1,1,-1,1,1,-1,1,1,1],
      [-1,-1,1,-1,1,1,-1,1,1,1,-1],
      [-1,1,-1,1,1,-1,1,1,1,-1,-1],
      [1,-1,1,1,-1,1,1,1,-1,-1,-1],
      [-1,1,1,-1,1,1,1,-1,-1,-1,1],
      [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1]
    ];

    const combinations = base.map(row => 
      row.map((val, i) => factors[i] ? (val === 1 ? factors[i].levels[0] : factors[i].levels[1]) : '')
    );

    const newMatrix: DOERun[] = combinations.map(combo => {
      const values: Record<string, string> = {};
      factors.forEach((f, i) => { values[f.id] = combo[i]; });
      return { id: uuidv4(), values };
    });

    finalizeMatrix(newMatrix, 'L12');
  };

  const generateL18 = () => {
    // L18(2^1 * 3^7) - Mixed level array
    if (factors.length === 0) return;
    
    // Check if first factor has 2 levels and others have 3
    const firstFactor = factors[0];
    const otherFactors = factors.slice(1);
    
    if (firstFactor.levels.length !== 2) {
      toast.error('L18 第一個因子必須為 2 水準');
      return;
    }
    if (otherFactors.some(f => f.levels.length !== 3)) {
      toast.error('L18 其他因子必須為 3 水準');
      return;
    }

    const base = [
      [0,0,0,0,0,0,0,0], [0,0,1,1,1,1,1,1], [0,0,2,2,2,2,2,2],
      [0,1,0,0,1,1,2,2], [0,1,1,1,2,2,0,0], [0,1,2,2,0,0,1,1],
      [0,2,0,1,0,2,1,2], [0,2,1,2,1,0,2,0], [0,2,2,0,2,1,0,1],
      [1,0,0,2,2,1,1,0], [1,0,1,0,0,2,2,1], [1,0,2,1,1,0,0,2],
      [1,1,0,1,2,0,2,1], [1,1,1,2,0,1,0,2], [1,1,2,0,1,2,1,0],
      [1,2,0,2,1,2,0,1], [1,2,1,0,2,0,1,2], [1,2,2,1,0,1,2,0]
    ];

    const combinations = base.map(row => 
      row.map((val, i) => {
        const factor = factors[i];
        return factor ? factor.levels[val] : '';
      })
    );

    const newMatrix: DOERun[] = combinations.map(combo => {
      const values: Record<string, string> = {};
      factors.forEach((f, i) => { values[f.id] = combo[i]; });
      return { id: uuidv4(), values };
    });

    finalizeMatrix(newMatrix, 'L18');
  };

  const finalizeMatrix = (baseMatrix: DOERun[], typeName: string) => {
    let finalMatrix = baseMatrix;
    if (replications > 1) {
      const replicated: DOERun[] = [];
      finalMatrix.forEach(run => {
        for (let i = 0; i < replications; i++) {
          replicated.push({ ...run, id: uuidv4(), isReplication: i > 0, originalRunId: run.id });
        }
      });
      finalMatrix = replicated;
    }
    if (randomized) finalMatrix = [...finalMatrix].sort(() => Math.random() - 0.5);
    finalMatrix = finalMatrix.map((run, idx) => ({ ...run, runOrder: idx + 1 }));
    setMatrix(finalMatrix);
    setStep(2);
    toast.success(`成功生成 ${finalMatrix.length} 組實驗組合 (${typeName})`);
  };

  const handleGenerate = () => {
    if (designType === 'FullFactorial') {
      generateFullFactorial();
    } else if (designType === 'L4') {
      generateTaguchi('L4');
    } else if (designType === 'L9') {
      generateTaguchi('L9');
    } else if (designType === 'L12') {
      generateTaguchi('L12');
    } else if (designType === 'L18') {
      generateTaguchi('L18');
    }
  };

  const handleSave = async () => {
    if (!name) {
      toast.error('請輸入實驗名稱');
      return;
    }

    const sessionId = uuidv4();
    
    // Create experiment drafts and link them to the matrix
    const updatedMatrix = [...matrix];
    const experimentPromises = updatedMatrix.map((run, idx) => {
      const expId = uuidv4();
      run.experimentId = expId; // Link the experiment ID to the run
      
      const exp: Experiment = {
        id: expId,
        projectId,
        title: `${name} - Run ${idx + 1}`,
        date: new Date().toISOString().split('T')[0],
        operator: user?.name || '系統管理員',
        status: 'Draft',
        doeSessionId: sessionId,
        processConditions: factors.map(f => {
          // Find matching master data for category and unit
          const masterParam = processParams.find(p => p.name === f.name);
          
          let conditionType = masterParam?.category || 'Other';
          
          // Fallback heuristic if not found in master data
          if (conditionType === 'Other' && f.type === 'Numerical') {
            const name = f.name.toLowerCase();
            if (name.includes('溫度') || name.includes('temp')) conditionType = 'Temperature';
            else if (name.includes('壓力') || name.includes('press')) conditionType = 'Pressure';
            else if (name.includes('時間') || name.includes('time')) conditionType = 'Time';
            else if (name.includes('能量') || name.includes('energy')) conditionType = 'Energy';
            else if (name.includes('濃度') || name.includes('conc')) conditionType = 'Concentration';
          }

          return {
            id: uuidv4(),
            name: f.name,
            type: conditionType as any,
            value: f.type === 'Numerical' ? (parseFloat(run.values[f.id]) || 0) : 0,
            unit: masterParam?.unit || f.unit || '',
          };
        }),
        formulation: [],
        observations: '',
        anomalies: '',
        conclusions: '',
        suggestions: ''
      };
      return savePersistentExperiment(exp);
    });

    const session: DOESession = {
      id: sessionId,
      projectId,
      name,
      description,
      factors,
      matrix: updatedMatrix,
      status: 'Planning',
      designMethod: designType,
      replications,
      randomized,
      snRatioType,
      createdAt: new Date().toISOString(),
      createdBy: user?.name || '系統管理員'
    };

    try {
      await Promise.all(experimentPromises);
      onSave(session);
      toast.success(`DOE 實驗計畫已儲存，並已生成 ${matrix.length} 組實驗草稿`);
    } catch (error) {
      console.error('Error saving DOE session and experiments:', error);
      toast.error('儲存失敗');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">DOE 實驗助手</h2>
          <p className="text-sm text-slate-500">規劃結構化實驗，找出最佳參數組合。</p>
        </div>
        <div className="flex items-center gap-2">
          {step === 2 && (
            <button 
              onClick={() => setStep(1)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              返回設定
            </button>
          )}
          <button 
            onClick={handleSave}
            disabled={matrix.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            儲存計畫
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="text-sm font-bold text-slate-900 mb-4">基本資訊</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">計畫名稱</label>
                <input 
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：固化參數優化"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm focus:bg-white focus:border-brand-500 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">描述</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="說明實驗目的..."
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm focus:bg-white focus:border-brand-500 transition-all outline-none resize-none"
                />
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl bg-brand-50/30 border-brand-100">
            <h3 className="text-sm font-bold text-brand-900 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" />
              DOE 使用說明
            </h3>
            <div className="space-y-3 text-[11px] text-brand-700 leading-relaxed">
              <p>
                <span className="font-bold">1. 設定因子：</span>
                點擊「新增因子」並輸入名稱（或從下拉選單選擇已儲存的製程參數）。
              </p>
              <p>
                <span className="font-bold">2. 設定水準：</span>
                為每個因子設定至少兩個測試水準（例如：溫度 100°C 與 120°C）。
              </p>
              <p>
                <span className="font-bold">3. 生成矩陣：</span>
                點擊「生成實驗矩陣」，系統將自動計算所有可能的實驗組合。
              </p>
              <p>
                <span className="font-bold">4. 儲存計畫：</span>
                儲存後，系統會自動在「實驗紀錄」中生成對應的實驗草稿。
              </p>
              <div className="pt-2 border-t border-brand-100">
                <p className="italic">提示：建議先選擇 2-3 個關鍵因子進行測試。若因子過多，實驗次數會呈指數增長。</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {step === 1 ? (
            <div className="glass-panel p-8 rounded-2xl space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-brand-500" />
                  因子與水準設定
                </h3>
                <button 
                  onClick={addFactor}
                  className="flex items-center gap-2 px-3 py-1.5 bg-brand-50 text-brand-600 rounded-lg text-xs font-bold hover:bg-brand-100 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  新增因子
                </button>
              </div>

              <div className="space-y-6">
                {factors.map((factor) => (
                  <div key={factor.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">因子名稱</label>
                          <button 
                            onClick={() => removeFactor(factor.id)}
                            className="p-1 text-slate-300 hover:text-rose-500 transition-all"
                            title="刪除因子"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="relative group/search">
                          <input 
                            type="text"
                            value={factor.name}
                            onChange={(e) => updateFactor(factor.id, 'name', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:border-brand-500"
                            placeholder="輸入或選擇因子..."
                          />
                          <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-xl shadow-xl mt-1 z-10 hidden group-focus-within/search:block max-h-48 overflow-y-auto">
                            {processParams.map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setFactors(factors.map(f => f.id === factor.id ? { 
                                    ...f, 
                                    name: p.name, 
                                    unit: p.unit,
                                    type: p.category === 'Other' ? 'Categorical' : 'Numerical'
                                  } : f));
                                }}
                                className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                              >
                                <span className="font-bold text-slate-700">{p.name}</span>
                                <span className="ml-2 text-slate-400">({p.category} - {p.unit})</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">類型</label>
                          <select 
                            value={factor.type}
                            onChange={(e) => updateFactor(factor.id, 'type', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-600 outline-none focus:border-brand-500"
                          >
                            <option value="Numerical">數值 (Numerical)</option>
                            <option value="Categorical">類別 (Categorical)</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between mb-4">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">水準 (Levels)</label>
                          <button 
                            onClick={() => addLevel(factor.id)}
                            className="flex items-center gap-1 px-2 py-1 bg-brand-50 text-brand-600 rounded-lg text-[10px] font-bold hover:bg-brand-100 transition-all mr-8"
                          >
                            <Plus className="w-3 h-3" />
                            新增水準
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          {factor.levels.map((level, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 group/level hover:border-brand-300 transition-all">
                              <input 
                                type="text"
                                value={level}
                                onChange={(e) => updateLevel(factor.id, idx, e.target.value)}
                                className="flex-1 bg-transparent text-xs font-medium text-slate-700 outline-none"
                                placeholder={`水準 ${idx + 1}`}
                              />
                              {factor.levels.length > 2 && (
                                <button 
                                  onClick={() => removeLevel(factor.id, idx)}
                                  className="text-slate-300 hover:text-rose-500 transition-colors"
                                  title="刪除此水準"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {factors.length === 0 && (
                  <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-2xl text-slate-400">
                    <p className="text-sm">尚未新增任何因子</p>
                    <button 
                      onClick={addFactor}
                      className="mt-4 text-brand-600 font-bold hover:underline"
                    >
                      立即新增第一個因子
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-slate-100 flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">設計方法:</label>
                    <select 
                      value={designType}
                      onChange={(e) => setDesignType(e.target.value as any)}
                      className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="FullFactorial">全因子設計 (Full Factorial)</option>
                      <option value="L4">正交表 L4 (2^3)</option>
                      <option value="L9">正交表 L9 (3^4)</option>
                      <option value="L12">正交表 L12 (2^11)</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">重複次數 (Replications):</label>
                    <input 
                      type="number"
                      min="1"
                      max="5"
                      value={replications}
                      onChange={(e) => setReplications(parseInt(e.target.value) || 1)}
                      className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">分析目標 (S/N Ratio):</label>
                    <select 
                      value={snRatioType}
                      onChange={(e) => setSnRatioType(e.target.value as any)}
                      className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="Larger">望大 (越強/越高越好)</option>
                      <option value="Smaller">望小 (越低/越少越好)</option>
                      <option value="Nominal">望目 (接近目標值最好)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className={cn(
                      "w-10 h-5 rounded-full transition-all relative",
                      randomized ? "bg-brand-500" : "bg-slate-200"
                    )}>
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={randomized}
                        onChange={() => setRandomized(!randomized)}
                      />
                      <div className={cn(
                        "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                        randomized ? "left-6" : "left-1"
                      )} />
                    </div>
                    <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors">隨機化實驗順序 (Randomize)</span>
                  </label>

                  <button 
                    onClick={handleGenerate}
                    disabled={factors.length === 0}
                    className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    生成實驗矩陣
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel p-8 rounded-2xl space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <TableIcon className="w-5 h-5 text-brand-500" />
                  實驗矩陣 (共 {matrix.length} 組)
                </h3>
                <p className="text-xs text-slate-500 italic">系統已自動為您規劃最佳路徑</p>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-16">Run</th>
                      {factors.map(f => (
                        <th key={f.id} className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {f.name}
                        </th>
                      ))}
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">狀態</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {matrix.map((run, idx) => (
                      <tr key={run.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-mono text-slate-400">{idx + 1}</td>
                        {factors.map(f => (
                          <td key={f.id} className="px-6 py-4">
                            <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600">
                              {run.values[f.id]}
                            </span>
                          </td>
                        ))}
                        <td className="px-6 py-4 text-right">
                          <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded">待建立</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
