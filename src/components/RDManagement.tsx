import React, { useState, useEffect } from 'react';
import { Beaker, FlaskConical, History, LineChart, Users, FileText, ChevronRight, Plus, Search, Filter, Trash2 } from 'lucide-react';
import { Project, Experiment, DOESession, Recipe, RecipeVersion, Sample } from '../types';
import { cn } from '../lib/utils';
import { 
  getPersistentProjects, 
  getPersistentExperiments, 
  getPersistentDOESessions, 
  getPersistentRecipes,
  savePersistentDOESession,
  deletePersistentDOESession,
  getPersistentSamples,
  savePersistentRecipe,
  savePersistentRecipeVersion
} from '../lib/persistence';
import { DOEAssistant } from './DOEAssistant';
import { DOEAnalysis } from './DOEAnalysis';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from './AuthContext';

export const RDManagement: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [doeSessions, setDoeSessions] = useState<DOESession[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [samples, setSamples] = useState<Record<string, Sample[]>>({});
  const [loading, setLoading] = useState(true);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newRecipeDesc, setNewRecipeDesc] = useState('');
  const [doeView, setDoeView] = useState<'setup' | 'list' | 'analysis'>('setup');
  const [selectedDoeSession, setSelectedDoeSession] = useState<DOESession | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [p, e, d, r] = await Promise.all([
        getPersistentProjects(),
        getPersistentExperiments(),
        getPersistentDOESessions(),
        getPersistentRecipes()
      ]);
      setProjects(p);
      setExperiments(e);
      setDoeSessions(d);
      setRecipes(r);
      if (p.length > 0) setSelectedProjectId(p[0].id);

      // Fetch samples for all experiments for data mining
      const sampleMap: Record<string, Sample[]> = {};
      await Promise.all(e.map(async (exp) => {
        const s = await getPersistentSamples(exp.id);
        sampleMap[exp.id] = s;
      }));
      setSamples(sampleMap);
      
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleSaveDOESession = async (session: DOESession) => {
    await savePersistentDOESession(session);
    setDoeSessions([session, ...doeSessions]);
    setDoeView('list');
    toast.success('DOE 計畫已儲存');
  };

  const handleDeleteDOESession = async (id: string) => {
    toast('確定要刪除此 DOE 計畫嗎？', {
      action: {
        label: '確定刪除',
        onClick: async () => {
          try {
            await deletePersistentDOESession(id);
            setDoeSessions(prev => prev.filter(s => s.id !== id));
            toast.success('DOE 計畫已刪除');
          } catch (error) {
            console.error('Error deleting DOE session:', error);
            toast.error('刪除失敗');
          }
        }
      },
      duration: 5000,
    });
  };

  const handleCreateRecipe = async () => {
    if (!newRecipeName) {
      toast.error('請輸入配方名稱');
      return;
    }

    const recipeId = uuidv4();
    const versionId = uuidv4();
    const now = new Date().toISOString();

    const newRecipe: Recipe = {
      id: recipeId,
      name: newRecipeName,
      description: newRecipeDesc,
      currentVersionId: versionId,
      projectId: selectedProjectId,
      createdAt: now,
      updatedAt: now
    };

    const initialVersion: RecipeVersion = {
      id: versionId,
      recipeId: recipeId,
      versionNumber: '1.0',
      description: '初始版本',
      formulation: [],
      processConditions: [],
      createdBy: user?.name || 'System',
      createdAt: now
    };

    try {
      await savePersistentRecipe(newRecipe);
      await savePersistentRecipeVersion(recipeId, initialVersion);
      setRecipes([...recipes, newRecipe]);
      setIsRecipeModalOpen(false);
      setNewRecipeName('');
      setNewRecipeDesc('');
      toast.success('配方已建立');
    } catch (error) {
      console.error('Error creating recipe:', error);
      toast.error('建立配方失敗');
    }
  };

  const filteredExperiments = experiments.filter(e => e.projectId === selectedProjectId);
  const filteredRecipes = recipes.filter(r => r.projectId === selectedProjectId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">研發管理中心 (R&D Center)</h1>
          <p className="text-slate-500 mt-1">整合 DOE、版本控制、數據挖掘與團隊協作。</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <FlaskConical className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select 
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all appearance-none"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="min-h-[600px]">
        <div className="space-y-6">
            <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
              <button 
                onClick={() => setDoeView('setup')}
                className={cn(
                  "text-sm font-bold transition-all",
                  doeView === 'setup' ? "text-brand-600" : "text-slate-400 hover:text-slate-600"
                )}
              >
                新建計畫
              </button>
              <button 
                onClick={() => setDoeView('list')}
                className={cn(
                  "text-sm font-bold transition-all",
                  doeView === 'list' ? "text-brand-600" : "text-slate-400 hover:text-slate-600"
                )}
              >
                歷史計畫
              </button>
              {doeView === 'analysis' && (
                <span className="text-sm font-bold text-brand-600 flex items-center gap-1">
                  <ChevronRight className="w-4 h-4" />
                  數據分析
                </span>
              )}
            </div>

            {doeView === 'setup' && (
              <DOEAssistant 
                projectId={selectedProjectId} 
                onSave={handleSaveDOESession} 
              />
            )}

            {doeView === 'list' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {doeSessions.filter(s => s.projectId === selectedProjectId).map(session => (
                  <div key={session.id} className="glass-panel p-6 rounded-2xl hover:border-brand-300 transition-all group">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-brand-50 text-brand-600 text-[10px] font-bold rounded uppercase tracking-wider">
                          {session.status}
                        </span>
                        <button 
                          onClick={() => handleDeleteDOESession(session.id)}
                          className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                          title="刪除計畫"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400">{session.createdAt.split('T')[0]}</span>
                    </div>
                    <h4 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-brand-600 transition-colors">{session.name}</h4>
                    <p className="text-sm text-slate-500 line-clamp-2 mb-6">{session.description || '無描述'}</p>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                      <div className="flex -space-x-2">
                        {session.factors.slice(0, 3).map((f, i) => (
                          <div key={i} className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-500" title={f.name}>
                            {f.name.charAt(0)}
                          </div>
                        ))}
                        {session.factors.length > 3 && (
                          <div className="w-6 h-6 rounded-full bg-slate-50 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-400">
                            +{session.factors.length - 3}
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => {
                          setSelectedDoeSession(session);
                          setDoeView('analysis');
                        }}
                        className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline"
                      >
                        <LineChart className="w-3.5 h-3.5" />
                        查看分析
                      </button>
                    </div>
                  </div>
                ))}
                {doeSessions.filter(s => s.projectId === selectedProjectId).length === 0 && (
                  <div className="col-span-full py-20 text-center glass-panel rounded-2xl border-dashed border-2 text-slate-400">
                    <Beaker className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-medium">尚未建立任何 DOE 計畫</p>
                    <button 
                      onClick={() => setDoeView('setup')}
                      className="mt-4 text-brand-600 font-bold hover:underline"
                    >
                      立即建立
                    </button>
                  </div>
                )}
              </div>
            )}

            {doeView === 'analysis' && selectedDoeSession && (
              <DOEAnalysis 
                session={selectedDoeSession} 
                onBack={() => setDoeView('list')} 
              />
            )}
          </div>
      </div>
      {/* Recipe Creation Modal */}
      {isRecipeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">建立新配方</h3>
              <button onClick={() => setIsRecipeModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">配方名稱</label>
                <input
                  type="text"
                  value={newRecipeName}
                  onChange={(e) => setNewRecipeName(e.target.value)}
                  placeholder="例如：標準光學樹脂 A-1"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">描述</label>
                <textarea
                  value={newRecipeDesc}
                  onChange={(e) => setNewRecipeDesc(e.target.value)}
                  placeholder="說明此配方的用途或特點..."
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setIsRecipeModalOpen(false)}
                  className="flex-1 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateRecipe}
                  className="flex-1 py-2 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-lg shadow-brand-200 transition-all"
                >
                  確認建立
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import { X } from 'lucide-react';
