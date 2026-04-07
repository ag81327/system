import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  getPersistentExperiments, 
  getPersistentProjects, 
  savePersistentExperiment, 
  deletePersistentExperiment 
} from '../lib/persistence';
import { 
  Beaker, 
  Calendar, 
  User, 
  ChevronRight, 
  Search, 
  Filter,
  Plus,
  CheckCircle2,
  Clock,
  Edit3,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Experiment } from '../types';
import { ExperimentModal } from './ExperimentModal';
import { useAuth } from './AuthContext';

export const ExperimentList = () => {
  const navigate = useNavigate();
  const { canAccessProject } = useAuth();
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExperiment, setEditingExperiment] = useState<Experiment | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Draft' | 'Completed'>('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [expsData, projsData] = await Promise.all([
          getPersistentExperiments(),
          getPersistentProjects()
        ]);
        setExperiments(expsData);
        setProjects(projsData);
      } catch (error) {
        console.error('Error fetching experiments:', error);
        toast.error('讀取數據失敗');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const accessibleExperiments = useMemo(() => 
    experiments.filter(exp => canAccessProject(exp.projectId)),
    [experiments, canAccessProject]
  );

  const handleAddExperiment = () => {
    setEditingExperiment(undefined);
    setIsModalOpen(true);
  };

  const handleEditExperiment = (e: React.MouseEvent, exp: Experiment) => {
    e.stopPropagation();
    setEditingExperiment(exp);
    setIsModalOpen(true);
  };

  const handleDeleteExperiment = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deletePersistentExperiment(deleteConfirmId);
      setExperiments(experiments.filter(e => e.id !== deleteConfirmId));
      setDeleteConfirmId(null);
      toast.success('實驗紀錄已刪除');
    } catch (error) {
      console.error('Error deleting experiment:', error);
      toast.error('刪除失敗');
    }
  };

  const handleSaveExperiment = async (expData: Omit<Experiment, 'id'>) => {
    try {
      if (editingExperiment) {
        const updatedExp: Experiment = { ...editingExperiment, ...expData };
        await savePersistentExperiment(updatedExp);
        setExperiments(experiments.map(e => e.id === editingExperiment.id ? updatedExp : e));
        toast.success('實驗紀錄已更新');
      } else {
        const newExp: Experiment = {
          ...expData,
          id: `e${Date.now()}`,
        };
        await savePersistentExperiment(newExp);
        setExperiments([newExp, ...experiments]);
        toast.success('實驗紀錄已建立');
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving experiment:', error);
      toast.error('儲存失敗');
    }
  };

  const filteredExperiments = accessibleExperiments.filter(exp => {
    const matchesSearch = exp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         exp.operator.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || exp.status === statusFilter;
    
    const matchesDate = (!dateRange.start || exp.date >= dateRange.start) &&
                       (!dateRange.end || exp.date <= dateRange.end);
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">實驗紀錄</h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">追蹤並管理您的實驗室測試與觀察紀錄。</p>
        </div>
        <button 
          onClick={handleAddExperiment}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-all shadow-lg shadow-brand-200"
        >
          <Plus className="w-4 h-4" />
          新增實驗
        </button>
      </div>

      <div className="glass-panel rounded-2xl overflow-visible">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="篩選實驗紀錄..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-50 rounded-lg text-sm transition-all outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button 
                onClick={() => {
                  setIsFilterOpen(!isFilterOpen);
                  setIsDateRangeOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-all",
                  statusFilter !== 'all' || isFilterOpen ? "bg-brand-50 border-brand-200 text-brand-600" : "text-slate-600 hover:bg-slate-50 border-slate-200"
                )}
              >
                <Filter className="w-4 h-4" />
                篩選條件
                {statusFilter !== 'all' && <span className="w-2 h-2 rounded-full bg-brand-500"></span>}
              </button>
              
              {isFilterOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsFilterOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2">狀態篩選</p>
                      <button 
                        onClick={() => { setStatusFilter('all'); setIsFilterOpen(false); }}
                        className={cn("w-full text-left px-3 py-2 text-sm rounded-lg transition-colors", statusFilter === 'all' ? "bg-brand-50 text-brand-600 font-bold" : "text-slate-600 hover:bg-slate-50")}
                      >
                        全部狀態
                      </button>
                      <button 
                        onClick={() => { setStatusFilter('Completed'); setIsFilterOpen(false); }}
                        className={cn("w-full text-left px-3 py-2 text-sm rounded-lg transition-colors", statusFilter === 'Completed' ? "bg-brand-50 text-brand-600 font-bold" : "text-slate-600 hover:bg-slate-50")}
                      >
                        已完成
                      </button>
                      <button 
                        onClick={() => { setStatusFilter('Draft'); setIsFilterOpen(false); }}
                        className={cn("w-full text-left px-3 py-2 text-sm rounded-lg transition-colors", statusFilter === 'Draft' ? "bg-brand-50 text-brand-600 font-bold" : "text-slate-600 hover:bg-slate-50")}
                      >
                        草稿
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button 
                onClick={() => {
                  setIsDateRangeOpen(!isDateRangeOpen);
                  setIsFilterOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-all",
                  (dateRange.start || dateRange.end) || isDateRangeOpen ? "bg-brand-50 border-brand-200 text-brand-600" : "text-slate-600 hover:bg-slate-50 border-slate-200"
                )}
              >
                <Calendar className="w-4 h-4" />
                日期範圍
                {(dateRange.start || dateRange.end) && <span className="w-2 h-2 rounded-full bg-brand-500"></span>}
              </button>

              {isDateRangeOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsDateRangeOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-4 space-y-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">選擇日期區間</p>
                      <div className="space-y-2">
                        <label className="text-xs text-slate-500">從</label>
                        <input 
                          type="date" 
                          value={dateRange.start}
                          onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                          className="w-full bg-slate-50 border-none text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-slate-500">至</label>
                        <input 
                          type="date" 
                          value={dateRange.end}
                          onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                          className="w-full bg-slate-50 border-none text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button 
                          onClick={() => setDateRange({ start: '', end: '' })}
                          className="flex-1 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                          重設
                        </button>
                        <button 
                          onClick={() => setIsDateRangeOpen(false)}
                          className="flex-1 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
                        >
                          套用
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">實驗標題</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">所屬專案</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">日期</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">實驗人員</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">狀態</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExperiments.map((exp) => {
                const project = projects.find(p => p.id === exp.projectId);
                return (
                  <tr 
                    key={exp.id} 
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => navigate(`/experiments/${exp.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                          <Beaker className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-bold text-slate-900">{exp.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                        {project?.name || '未知專案'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {exp.date}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {exp.operator}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold",
                        exp.status === 'Completed' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                      )}>
                        {exp.status === 'Completed' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {exp.status === 'Completed' ? '已完成' : '草稿'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={(e) => handleEditExperiment(e, exp)}
                          className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all"
                          title="編輯"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => handleDeleteExperiment(e, exp.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="刪除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-brand-600 transition-colors" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">顯示 {filteredExperiments.length} 筆實驗紀錄</p>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 text-xs font-bold text-slate-400 cursor-not-allowed">上一頁</button>
            <button className="px-3 py-1 text-xs font-bold text-brand-600 bg-white border border-slate-200 rounded-md shadow-sm">1</button>
            <button className="px-3 py-1 text-xs font-bold text-slate-400 cursor-not-allowed">下一頁</button>
          </div>
        </div>
      </div>

      <ExperimentModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveExperiment}
        initialData={editingExperiment}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">確認刪除實驗紀錄</h3>
              <p className="text-sm text-slate-500 mt-1">確定要刪除此實驗紀錄嗎？此動作無法復原。</p>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3 p-4 bg-rose-50 rounded-xl border border-rose-100">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                <p className="text-sm text-rose-700 font-medium">這將會永久刪除此實驗及其所有相關數據。</p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-200 transition-all"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
