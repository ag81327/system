import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getPersistentExperiments, 
  getPersistentProjects, 
  savePersistentExperiment, 
  deletePersistentExperiment,
  getPersistentUsers
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
  AlertCircle,
  LayoutGrid,
  Check,
  X,
  Lock,
  Shield,
  Users
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Experiment, User as AppUser } from '../types';
import { ExperimentModal } from './ExperimentModal';
import { useAuth } from './AuthContext';
import { useComparison } from './ComparisonContext';

export const ExperimentList = () => {
  const navigate = useNavigate();
  const { canAccessProject, canAccessExperiment, user } = useAuth();
  const { addToComparison, removeFromComparison, isInComparison, selectedExperiments } = useComparison();
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [editingExperiment, setEditingExperiment] = useState<Experiment | undefined>(undefined);
  const [permissionExperiment, setPermissionExperiment] = useState<Experiment | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<'all' | 'Draft' | 'Completed'>('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isSortOpen, setIsSortOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [expsData, projsData, usersData] = await Promise.all([
          getPersistentExperiments(),
          getPersistentProjects(),
          getPersistentUsers()
        ]);
        setExperiments(expsData);
        setProjects(projsData);
        setUsers(usersData.filter(u => u.role !== 'Admin')); // Only show non-admins for permission management
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
    experiments.filter(exp => {
      const basicAccess = canAccessProject(exp.projectId) && canAccessExperiment(exp.projectId, exp.date);
      if (!basicAccess) return false;
      if (user?.role === 'Admin') return true;
      if (exp.visibleTo && exp.visibleTo.length > 0) {
        return exp.visibleTo.includes(user?.id || '');
      }
      return true;
    }),
    [experiments, canAccessProject, canAccessExperiment, user]
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
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(deleteConfirmId);
        return next;
      });
      setDeleteConfirmId(null);
      toast.success('實驗紀錄已刪除');
    } catch (error) {
      console.error('Error deleting experiment:', error);
      toast.error('刪除失敗');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    setPromptConfig({
      isOpen: true,
      title: '確認批量刪除',
      message: `確定要刪除選取的 ${selectedIds.size} 筆實驗紀錄嗎？此動作無法復原。`,
      type: 'confirm',
      onConfirm: async () => {
        try {
          const promises = Array.from(selectedIds).map(id => deletePersistentExperiment(id));
          await Promise.all(promises);
          setExperiments(experiments.filter(e => !selectedIds.has(e.id)));
          setSelectedIds(new Set());
          toast.success('選取的實驗紀錄已刪除');
        } catch (error) {
          console.error('Error bulk deleting experiments:', error);
          toast.error('部分刪除失敗');
        }
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredExperiments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredExperiments.map(e => e.id)));
    }
  };

  const toggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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
        
        // Notify users who have access to this project
        const { createNotification } = await import('../services/notificationService');
        const { getPersistentPermissions } = await import('../lib/persistence');
        const allPermissions = await getPersistentPermissions();
        const usersWithAccess = allPermissions.filter(p => p.projectIds.includes(newExp.projectId));
        
        const promises = usersWithAccess.map(p => 
          createNotification({
            userId: p.userId,
            title: '新實驗紀錄',
            message: `專案中有新的實驗紀錄: ${newExp.title}`,
            type: 'info',
            link: `/experiments/${newExp.id}`
          })
        );
        await Promise.all(promises);

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

  const sortedExperiments = useMemo(() => {
    return [...filteredExperiments].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = a.date.localeCompare(b.date);
      } else if (sortBy === 'title') {
        comparison = a.title.localeCompare(b.title);
      } else if (sortBy === 'status') {
        comparison = a.status.localeCompare(b.status);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredExperiments, sortBy, sortOrder]);

  const handleToggleComparison = (e: React.MouseEvent, exp: Experiment) => {
    e.stopPropagation();
    if (isInComparison(exp.id)) {
      removeFromComparison(exp.id);
    } else {
      addToComparison(exp);
    }
  };

  const handleOpenPermissions = (e: React.MouseEvent, exp: Experiment) => {
    e.stopPropagation();
    setPermissionExperiment(exp);
    setIsPermissionModalOpen(true);
  };

  const handleSavePermissions = async (userIds: string[]) => {
    if (!permissionExperiment) return;
    try {
      const updatedExp = { ...permissionExperiment, visibleTo: userIds };
      await savePersistentExperiment(updatedExp);
      setExperiments(experiments.map(e => e.id === updatedExp.id ? updatedExp : e));
      toast.success('存取權限已更新');
      setIsPermissionModalOpen(false);
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error('更新權限失敗');
    }
  };

  const [promptConfig, setPromptConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'confirm';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'confirm',
    onConfirm: () => {},
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
            {selectedIds.size > 0 && (
              <button 
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-all animate-in fade-in slide-in-from-right-2"
              >
                <Trash2 className="w-4 h-4" />
                批量刪除 ({selectedIds.size})
              </button>
            )}
            
            <div className="relative">
              <button 
                onClick={() => {
                  setIsSortOpen(!isSortOpen);
                  setIsFilterOpen(false);
                  setIsDateRangeOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-all",
                  isSortOpen ? "bg-brand-50 border-brand-200 text-brand-600" : "text-slate-600 hover:bg-slate-50 border-slate-200"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
                排序方式
              </button>
              
              {isSortOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsSortOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2">排序欄位</p>
                      <button 
                        onClick={() => { setSortBy('date'); setIsSortOpen(false); }}
                        className={cn("w-full text-left px-3 py-2 text-sm rounded-lg transition-colors", sortBy === 'date' ? "bg-brand-50 text-brand-600 font-bold" : "text-slate-600 hover:bg-slate-50")}
                      >
                        日期
                      </button>
                      <button 
                        onClick={() => { setSortBy('title'); setIsSortOpen(false); }}
                        className={cn("w-full text-left px-3 py-2 text-sm rounded-lg transition-colors", sortBy === 'title' ? "bg-brand-50 text-brand-600 font-bold" : "text-slate-600 hover:bg-slate-50")}
                      >
                        標題
                      </button>
                      <button 
                        onClick={() => { setSortBy('status'); setIsSortOpen(false); }}
                        className={cn("w-full text-left px-3 py-2 text-sm rounded-lg transition-colors", sortBy === 'status' ? "bg-brand-50 text-brand-600 font-bold" : "text-slate-600 hover:bg-slate-50")}
                      >
                        狀態
                      </button>
                      <div className="h-px bg-slate-100 my-2"></div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2">排序方向</p>
                      <button 
                        onClick={() => { setSortOrder('asc'); setIsSortOpen(false); }}
                        className={cn("w-full text-left px-3 py-2 text-sm rounded-lg transition-colors", sortOrder === 'asc' ? "bg-brand-50 text-brand-600 font-bold" : "text-slate-600 hover:bg-slate-50")}
                      >
                        遞增 (A-Z)
                      </button>
                      <button 
                        onClick={() => { setSortOrder('desc'); setIsSortOpen(false); }}
                        className={cn("w-full text-left px-3 py-2 text-sm rounded-lg transition-colors", sortOrder === 'desc' ? "bg-brand-50 text-brand-600 font-bold" : "text-slate-600 hover:bg-slate-50")}
                      >
                        遞減 (Z-A)
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

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
                <th className="px-6 py-4 w-10">
                  <input 
                    type="checkbox"
                    checked={selectedIds.size > 0 && selectedIds.size === sortedExperiments.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  />
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">實驗標題</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">所屬專案</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">日期</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">實驗人員</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">狀態</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedExperiments.map((exp) => {
                const project = projects.find(p => p.id === exp.projectId);
                return (
                  <tr 
                    key={exp.id} 
                    className={cn(
                      "hover:bg-slate-50/80 transition-colors group cursor-pointer",
                      selectedIds.has(exp.id) && "bg-brand-50/30"
                    )}
                    onClick={() => navigate(`/experiments/${exp.id}`)}
                  >
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox"
                        checked={selectedIds.has(exp.id)}
                        onChange={(e) => toggleSelect(e as any, exp.id)}
                        className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                      />
                    </td>
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
                          onClick={(e) => handleToggleComparison(e, exp)}
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            isInComparison(exp.id) 
                              ? "bg-brand-600 text-white shadow-md" 
                              : "text-slate-400 hover:text-brand-600 hover:bg-brand-50"
                          )}
                          title={isInComparison(exp.id) ? "從比對中移除" : "加入比對"}
                        >
                          {isInComparison(exp.id) ? <Check className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
                        </button>
                        {user?.role === 'Admin' && (
                          <button 
                            onClick={(e) => handleOpenPermissions(e, exp)}
                            className={cn(
                              "p-2 rounded-lg transition-all",
                              exp.visibleTo && exp.visibleTo.length > 0 
                                ? "text-amber-600 bg-amber-50 hover:bg-amber-100" 
                                : "text-slate-400 hover:text-brand-600 hover:bg-brand-50"
                            )}
                            title="存取權限管理"
                          >
                            <Lock className="w-4 h-4" />
                          </button>
                        )}
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

      {/* Bulk Delete Confirmation Modal */}
      <AnimatePresence>
        {promptConfig.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">{promptConfig.title}</h3>
                <p className="text-sm text-slate-500 mt-1">{promptConfig.message}</p>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3 p-4 bg-rose-50 rounded-xl border border-rose-100">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  <p className="text-sm text-rose-700 font-medium">此動作無法復原。</p>
                </div>
              </div>
              <div className="p-4 bg-slate-50 flex justify-end gap-3">
                <button
                  onClick={() => setPromptConfig({ ...promptConfig, isOpen: false })}
                  className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    promptConfig.onConfirm();
                    setPromptConfig({ ...promptConfig, isOpen: false });
                  }}
                  className="px-6 py-2 bg-rose-500 text-white rounded-lg text-sm font-bold hover:bg-rose-600 shadow-lg shadow-rose-200"
                >
                  確認刪除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Permission Management Modal */}
      <AnimatePresence>
        {isPermissionModalOpen && permissionExperiment && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">存取權限管理</h3>
                  <p className="text-xs text-slate-500 mt-1">{permissionExperiment.title}</p>
                </div>
                <button onClick={() => setIsPermissionModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="p-6">
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">選擇可查看的人員</p>
                  {users.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">尚無其他人員帳號</p>
                    </div>
                  ) : (
                    users.map(u => {
                      const isSelected = permissionExperiment.visibleTo?.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          onClick={() => {
                            const currentVisibleTo = permissionExperiment.visibleTo || [];
                            const newVisibleTo = isSelected 
                              ? currentVisibleTo.filter(id => id !== u.id)
                              : [...currentVisibleTo, u.id];
                            setPermissionExperiment({ ...permissionExperiment, visibleTo: newVisibleTo });
                          }}
                          className={cn(
                            "w-full p-3 rounded-xl border-2 flex items-center justify-between transition-all",
                            isSelected ? "border-brand-500 bg-brand-50" : "border-slate-100 hover:border-slate-200"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", isSelected ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-400")}>
                              <User className="w-4 h-4" />
                            </div>
                            <div className="text-left">
                              <p className={cn("text-sm font-bold", isSelected ? "text-brand-700" : "text-slate-700")}>{u.name}</p>
                              <p className="text-[10px] text-slate-400">{u.email}</p>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-brand-500" />}
                        </button>
                      );
                    })
                  )}
                </div>
                
                <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
                  <Shield className="w-5 h-5 text-amber-500 shrink-0" />
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    <strong>提示：</strong> 若未勾選任何人員，則該實驗紀錄預設對所有擁有專案存取權限的人員可見。勾選後，僅限被勾選的人員與管理員可查看。
                  </p>
                </div>
              </div>
              <div className="p-4 bg-slate-50 flex justify-end gap-3">
                <button
                  onClick={() => setIsPermissionModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
                >
                  取消
                </button>
                <button
                  onClick={() => handleSavePermissions(permissionExperiment.visibleTo || [])}
                  className="px-6 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 shadow-lg shadow-brand-200"
                >
                  儲存權限
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

      {/* Comparison Basket Floating UI */}
      <AnimatePresence>
        {selectedExperiments.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4"
          >
            <div className="bg-slate-900 text-white rounded-2xl shadow-2xl shadow-brand-200/20 p-4 flex items-center justify-between gap-6 border border-slate-800">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center">
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold">數據比對籃</p>
                  <p className="text-[10px] text-slate-400">已選擇 {selectedExperiments.length} 筆實驗 (最多 5 筆)</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2 overflow-hidden">
                  {selectedExperiments.map(exp => (
                    <div 
                      key={exp.id} 
                      className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold"
                      title={exp.title}
                    >
                      {exp.title.charAt(0)}
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => navigate('/comparison')}
                  className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-brand-900/50"
                >
                  開始比對
                </button>
                <button 
                  onClick={() => removeFromComparison(selectedExperiments[selectedExperiments.length - 1].id)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
