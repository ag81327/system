import React, { useState, useEffect } from 'react';
import { History, GitCompare, RotateCcw, ChevronRight, FileText, User, Calendar, ArrowRight } from 'lucide-react';
import { Recipe, RecipeVersion } from '../types';
import { cn } from '../lib/utils';
import { getPersistentRecipeVersions } from '../lib/persistence';
import { format } from 'date-fns';

interface RecipeVersioningProps {
  recipe: Recipe;
  onRollback: (version: RecipeVersion) => void;
}

export const RecipeVersioning: React.FC<RecipeVersioningProps> = ({ recipe, onRollback }) => {
  const [versions, setVersions] = useState<RecipeVersion[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVersions = async () => {
      const data = await getPersistentRecipeVersions(recipe.id);
      setVersions(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLoading(false);
    };
    fetchVersions();
  }, [recipe.id]);

  const toggleSelection = (id: string) => {
    if (selectedVersions.includes(id)) {
      setSelectedVersions(selectedVersions.filter(v => v !== id));
    } else if (selectedVersions.length < 2) {
      setSelectedVersions([...selectedVersions, id]);
    }
  };

  const getDiff = () => {
    if (selectedVersions.length !== 2) return null;
    const v1 = versions.find(v => v.id === selectedVersions[0]);
    const v2 = versions.find(v => v.id === selectedVersions[1]);
    if (!v1 || !v2) return null;

    // Compare formulation
    const formulationDiff = v1.formulation.map(item => {
      const otherItem = v2.formulation.find(i => i.materialName === item.materialName);
      return {
        name: item.materialName,
        v1: item.theoreticalWeight,
        v2: otherItem ? otherItem.theoreticalWeight : 0,
        diff: item.theoreticalWeight - (otherItem ? otherItem.theoreticalWeight : 0)
      };
    });

    return { v1, v2, formulationDiff };
  };

  const diffResult = getDiff();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">配方版本管理</h2>
          <p className="text-sm text-slate-500">追蹤配方演進，確保製程穩定性。</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            disabled={selectedVersions.length !== 2}
            className="flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-600 rounded-lg text-sm font-bold hover:bg-brand-100 transition-all disabled:opacity-50"
          >
            <GitCompare className="w-4 h-4" />
            版本比對
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Version Timeline */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <History className="w-4 h-4 text-brand-500" />
              修訂歷史
            </h3>
            <div className="space-y-3">
              {versions.map((v) => (
                <div 
                  key={v.id}
                  onClick={() => toggleSelection(v.id)}
                  className={cn(
                    "p-4 rounded-xl border transition-all cursor-pointer group",
                    selectedVersions.includes(v.id) 
                      ? "bg-brand-50 border-brand-200 ring-1 ring-brand-200" 
                      : "bg-white border-slate-100 hover:border-brand-200"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                      v{v.versionNumber}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {format(new Date(v.createdAt), 'yyyy/MM/dd HH:mm')}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-700 line-clamp-1 mb-2">{v.description}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {v.createdBy}
                    </div>
                    {recipe.currentVersionId === v.id && (
                      <span className="text-emerald-500 font-bold">當前版本</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Diff / Detail View */}
        <div className="lg:col-span-2">
          {diffResult ? (
            <div className="glass-panel p-8 rounded-2xl space-y-8 animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">版本 A</span>
                    <span className="text-lg font-bold text-slate-900">v{diffResult.v1.versionNumber}</span>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-300" />
                  <div className="text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">版本 B</span>
                    <span className="text-lg font-bold text-slate-900">v{diffResult.v2.versionNumber}</span>
                  </div>
                </div>
                <button 
                  onClick={() => onRollback(diffResult.v1)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  回滾至此版本
                </button>
              </div>

              <div className="space-y-6">
                <h4 className="text-sm font-bold text-slate-900">配方組成差異</h4>
                <div className="overflow-hidden border border-slate-100 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">材料名稱</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">v{diffResult.v1.versionNumber}</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">v{diffResult.v2.versionNumber}</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">差異</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {diffResult.formulationDiff.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-slate-700">{item.name}</td>
                          <td className="px-6 py-4 text-sm text-slate-600 text-center">{item.v1}%</td>
                          <td className="px-6 py-4 text-sm text-slate-600 text-center">{item.v2}%</td>
                          <td className="px-6 py-4 text-right">
                            <span className={cn(
                              "text-xs font-bold",
                              item.diff > 0 ? "text-emerald-500" : item.diff < 0 ? "text-rose-500" : "text-slate-400"
                            )}>
                              {item.diff > 0 ? `+${item.diff}` : item.diff}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center glass-panel p-12 rounded-2xl text-slate-400 border-dashed border-2">
              <GitCompare className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm font-medium">選取左側兩個版本進行比對</p>
              <p className="text-xs mt-2">點擊版本卡片即可選取</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
