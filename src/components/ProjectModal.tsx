import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, FlaskConical } from 'lucide-react';
import { Project, ProjectStatus, TestItem } from '../types';
import { cn } from '../lib/utils';
import { getPersistentTestItems } from '../lib/persistence';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Omit<Project, 'id' | 'updatedAt'>) => void;
  initialData?: Project;
}

interface SpecEntry {
  testItemId: string;
  testItemName: string;
  unit: string;
  specMin?: number;
  specMax?: number;
  targetValue?: number;
}

export const ProjectModal = ({ isOpen, onClose, onSave, initialData }: ProjectModalProps) => {
  const [formData, setFormData] = useState<Omit<Project, 'id' | 'updatedAt'>>({
    name: '',
    description: '',
    status: 'Planning',
    kpiTarget: '',
    startDate: new Date().toISOString().split('T')[0],
    specs: {},
  });

  const [specEntries, setSpecEntries] = useState<SpecEntry[]>([]);
  const [testItems, setTestItems] = useState<TestItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      getPersistentTestItems().then(setTestItems);
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        description: initialData.description,
        status: initialData.status,
        kpiTarget: initialData.kpiTarget,
        startDate: initialData.startDate,
        specs: initialData.specs || {},
      });

      // Convert Record to Array for UI
      if (initialData.specs && testItems.length > 0) {
        const entries: SpecEntry[] = Object.entries(initialData.specs).map(([id, spec]) => {
          const item = testItems.find(t => t.id === id);
          return {
            testItemId: id,
            testItemName: item?.name || '未知項目',
            unit: item?.unit || '',
            specMin: spec.min,
            specMax: spec.max,
            targetValue: spec.target,
          };
        });
        setSpecEntries(entries);
      } else {
        setSpecEntries([]);
      }
    } else {
      setFormData({
        name: '',
        description: '',
        status: 'Planning',
        kpiTarget: '',
        startDate: new Date().toISOString().split('T')[0],
        specs: {},
      });
      setSpecEntries([]);
    }
  }, [initialData, isOpen, testItems]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert Array back to Record for saving
    const specsRecord: Record<string, { min?: number; max?: number; target?: number }> = {};
    specEntries.forEach(entry => {
      specsRecord[entry.testItemId] = {
        min: entry.specMin,
        max: entry.specMax,
        target: entry.targetValue
      };
    });

    onSave({ ...formData, specs: specsRecord });
  };

  const addSpec = () => {
    const newSpec: SpecEntry = {
      testItemId: testItems[0]?.id || '',
      testItemName: testItems[0]?.name || '',
      unit: testItems[0]?.unit || '',
      specMin: testItems[0]?.specMin,
      specMax: testItems[0]?.specMax,
      targetValue: testItems[0]?.targetValue,
    };
    setSpecEntries([...specEntries, newSpec]);
  };

  const removeSpec = (index: number) => {
    const newSpecs = [...specEntries];
    newSpecs.splice(index, 1);
    setSpecEntries(newSpecs);
  };

  const updateSpec = (index: number, field: string, value: any) => {
    const newSpecs = [...specEntries];
    if (field === 'testItemId') {
      const selectedItem = testItems.find(t => t.id === value);
      if (selectedItem) {
        newSpecs[index] = {
          ...newSpecs[index],
          testItemId: selectedItem.id,
          testItemName: selectedItem.name,
          unit: selectedItem.unit,
          specMin: selectedItem.specMin,
          specMax: selectedItem.specMax,
          targetValue: selectedItem.targetValue,
        };
      }
    } else {
      newSpecs[index] = { ...newSpecs[index], [field]: value };
    }
    setSpecEntries(newSpecs);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              {initialData ? '編輯專案' : '建立新專案'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">請填寫專案的基本資訊與目標。</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto">
          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">專案名稱</label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：新世代聚合物開發"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">專案描述</label>
              <textarea
                required
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="簡述此專案的研究範圍與目的..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">目前狀態</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectStatus })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all"
                >
                  <option value="Planning">規劃中</option>
                  <option value="In Progress">進行中</option>
                  <option value="Paused">暫停</option>
                  <option value="Completed">已完成</option>
                  <option value="Archived">已封存</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">開始日期</label>
                <input
                  required
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">KPI 目標</label>
              <input
                required
                type="text"
                value={formData.kpiTarget}
                onChange={(e) => setFormData({ ...formData, kpiTarget: e.target.value })}
                placeholder="例如：抗拉強度 > 150MPa"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all"
              />
            </div>

            {/* Project Specs Section */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">專案規格設定 (LSL / USL)</label>
                <button
                  type="button"
                  onClick={addSpec}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-600 rounded-lg text-xs font-bold hover:bg-brand-100 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  新增測試項目
                </button>
              </div>

              <div className="space-y-3">
                {specEntries.map((spec, index) => (
                  <div key={index} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 relative group">
                    <button
                      type="button"
                      onClick={() => removeSpec(index)}
                      className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">測試項目</label>
                        <select
                          value={spec.testItemId}
                          onChange={(e) => updateSpec(index, 'testItemId', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                        >
                          {testItems.map(item => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">單位</label>
                        <input
                          type="text"
                          readOnly
                          value={spec.unit}
                          className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500 cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">LSL (Min)</label>
                        <input
                          type="number"
                          step="any"
                          value={spec.specMin ?? ''}
                          onChange={(e) => updateSpec(index, 'specMin', e.target.value ? parseFloat(e.target.value) : undefined)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">目標值</label>
                        <input
                          type="number"
                          step="any"
                          value={spec.targetValue ?? ''}
                          onChange={(e) => updateSpec(index, 'targetValue', e.target.value ? parseFloat(e.target.value) : undefined)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">USL (Max)</label>
                        <input
                          type="number"
                          step="any"
                          value={spec.specMax ?? ''}
                          onChange={(e) => updateSpec(index, 'specMax', e.target.value ? parseFloat(e.target.value) : undefined)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {specEntries.length === 0 && (
                  <div className="text-center py-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <FlaskConical className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">尚未設定專案規格</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3 sticky bottom-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 text-sm font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-200"
            >
              儲存專案
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
