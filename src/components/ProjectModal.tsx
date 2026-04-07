import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Project, ProjectStatus } from '../types';
import { cn } from '../lib/utils';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Omit<Project, 'id' | 'updatedAt'>) => void;
  initialData?: Project;
}

export const ProjectModal = ({ isOpen, onClose, onSave, initialData }: ProjectModalProps) => {
  const [formData, setFormData] = useState<Omit<Project, 'id' | 'updatedAt'>>({
    name: '',
    description: '',
    status: 'Planning',
    kpiTarget: '',
    startDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        description: initialData.description,
        status: initialData.status,
        kpiTarget: initialData.kpiTarget,
        startDate: initialData.startDate,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        status: 'Planning',
        kpiTarget: '',
        startDate: new Date().toISOString().split('T')[0],
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
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

        <form onSubmit={handleSubmit}>
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
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
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
