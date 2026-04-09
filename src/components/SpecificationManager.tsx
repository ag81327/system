import React, { useState, useEffect, useMemo } from 'react';
import { Save, Info, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { TestItem, Project } from '../types';

interface SpecificationManagerProps {
  project: Project;
  testItems: TestItem[];
  onUpdate: (projectId: string, updatedSpecs: Record<string, { min?: number; max?: number; target?: number }>) => void;
  onAddTestItem?: (name: string, unit: string) => void;
}

export const SpecificationManager = ({ project, testItems, onUpdate, onAddTestItem }: SpecificationManagerProps) => {
  const [localSpecs, setLocalSpecs] = useState<Record<string, { min?: number; max?: number; target?: number }>>(project.specs || {});
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalSpecs(project.specs || {});
  }, [project.id, project.specs]);

  const handleChange = (testItemId: string, field: 'min' | 'max' | 'target', value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value);
    setLocalSpecs(prev => ({
      ...prev,
      [testItemId]: {
        ...(prev[testItemId] || {}),
        [field]: numValue
      }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(project.id, localSpecs);
      toast.success(`${project.name} 的允收標準已更新`);
    } catch (error) {
      console.error('Error saving specs:', error);
      toast.error('儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddItem = () => {
    if (newItemName && onAddTestItem) {
      onAddTestItem(newItemName, newItemUnit);
      setNewItemName('');
      setNewItemUnit('');
      setIsAddingItem(false);
    }
  };

  const uniqueTestItems = useMemo(() => {
    const seen = new Set();
    return testItems.filter(item => {
      if (seen.has(item.name)) return false;
      seen.add(item.name);
      return true;
    });
  }, [testItems]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">專案允收標準管理 (LSL / USL)</h2>
          <p className="text-sm text-slate-500">
            正在設定：<span className="font-bold text-brand-600">{project.name}</span>
          </p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-all shadow-lg shadow-brand-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isSaving ? '儲存中...' : '儲存專案設定'}
        </button>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-100">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">測試項目</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">單位</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">下限 (LSL)</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">目標值</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">上限 (USL)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {uniqueTestItems.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                <td className="px-6 py-4">
                  <span className="text-sm font-bold text-slate-900">{item.name}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs text-slate-500">{item.unit}</span>
                </td>
                <td className="px-6 py-4">
                  <input 
                    type="number" 
                    value={localSpecs[item.id]?.min ?? ''} 
                    onChange={(e) => handleChange(item.id, 'min', e.target.value)}
                    placeholder="無限制"
                    className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </td>
                <td className="px-6 py-4">
                  <input 
                    type="number" 
                    value={localSpecs[item.id]?.target ?? ''} 
                    onChange={(e) => handleChange(item.id, 'target', e.target.value)}
                    placeholder="目標"
                    className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </td>
                <td className="px-6 py-4">
                  <input 
                    type="number" 
                    value={localSpecs[item.id]?.max ?? ''} 
                    onChange={(e) => handleChange(item.id, 'max', e.target.value)}
                    placeholder="無限制"
                    className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </td>
              </tr>
            ))}
            {isAddingItem ? (
              <tr className="bg-brand-50/30">
                <td className="px-6 py-4">
                  <input 
                    type="text" 
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="項目名稱"
                    autoFocus
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </td>
                <td className="px-6 py-4">
                  <input 
                    type="text" 
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    placeholder="單位"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </td>
                <td colSpan={3} className="px-6 py-4">
                  <div className="flex gap-2">
                    <button 
                      onClick={handleAddItem}
                      className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700"
                    >
                      確認新增
                    </button>
                    <button 
                      onClick={() => setIsAddingItem(false)}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-lg text-xs font-bold hover:bg-slate-50"
                    >
                      取消
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-4">
                  <button 
                    onClick={() => setIsAddingItem(true)}
                    className="flex items-center gap-2 text-sm font-bold text-brand-600 hover:underline"
                  >
                    <Plus className="w-4 h-4" />
                    新增測試項目
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex gap-3">
        <Info className="w-5 h-5 text-blue-500 shrink-0" />
        <div className="text-xs text-blue-700 leading-relaxed">
          <p className="font-bold mb-1">提示：</p>
          <ul className="list-disc list-inside space-y-1">
            <li>允收標準是針對每個專案獨立設定的。</li>
            <li>這些數值將直接影響該專案下所有實驗結果的「合格/不合格」判定。</li>
            <li>製程能力 (Cpk) 與 SPC 管制圖也會根據這些規格界限進行分析。</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
