import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { Experiment, Project } from '../types';
import { getPersistentProjects } from '../lib/persistence';
import { useAuth } from './AuthContext';
import { RichTextEditor } from './RichTextEditor';

interface ExperimentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (experiment: Omit<Experiment, 'id'>) => void;
  initialData?: Experiment;
}

export const ExperimentModal = ({ isOpen, onClose, onSave, initialData }: ExperimentModalProps) => {
  const { canAccessProject, user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);
      try {
        const data = await getPersistentProjects();
        setProjects(data);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setIsLoading(false);
      }
    };
    if (isOpen) {
      fetchProjects();
    }
  }, [isOpen]);

  const accessibleProjects = useMemo(() => 
    projects.filter(p => canAccessProject(p.id)),
    [projects, canAccessProject]
  );

  const [formData, setFormData] = useState<Omit<Experiment, 'id'>>({
    projectId: '',
    title: '',
    date: new Date().toISOString().split('T')[0],
    operator: user?.name || '張小明',
    observations: '',
    anomalies: '',
    conclusions: '',
    suggestions: '',
    recipeName: '',
    notes: '',
    status: 'Draft',
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        projectId: initialData.projectId,
        title: initialData.title,
        date: initialData.date,
        operator: initialData.operator,
        observations: initialData.observations,
        anomalies: initialData.anomalies,
        conclusions: initialData.conclusions,
        suggestions: initialData.suggestions,
        recipeName: initialData.recipeName || '',
        notes: initialData.notes || '',
        status: initialData.status,
      });
    } else {
      setFormData({
        projectId: accessibleProjects[0]?.id || '',
        title: '',
        date: new Date().toISOString().split('T')[0],
        operator: user?.name || '張小明',
        observations: '',
        anomalies: '',
        conclusions: '',
        suggestions: '',
        recipeName: '',
        notes: '',
        status: 'Draft',
      });
    }
  }, [initialData, isOpen, accessibleProjects, user]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              {initialData ? '編輯實驗紀錄' : '新增實驗紀錄'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">請填寫實驗的詳細資訊與觀察結果。</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto">
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">所屬專案</label>
                <select
                  required
                  value={formData.projectId}
                  onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all"
                >
                  {accessibleProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">實驗標題</label>
                <input
                  required
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="例如：批次 B001 拉伸測試"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">實驗日期</label>
                <input
                  required
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">實驗人員</label>
                <input
                  required
                  type="text"
                  value={formData.operator}
                  onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">配方名稱</label>
              <input
                type="text"
                value={formData.recipeName}
                onChange={(e) => setFormData({ ...formData, recipeName: e.target.value })}
                placeholder="例如：標準配方 A-1"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">狀態</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="Draft"
                    checked={formData.status === 'Draft'}
                    onChange={() => setFormData({ ...formData, status: 'Draft' })}
                    className="w-4 h-4 text-brand-600"
                  />
                  <span className="text-sm text-slate-600">草稿</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="Completed"
                    checked={formData.status === 'Completed'}
                    onChange={() => setFormData({ ...formData, status: 'Completed' })}
                    className="w-4 h-4 text-brand-600"
                  />
                  <span className="text-sm text-slate-600">已完成</span>
                </label>
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
              儲存實驗
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
