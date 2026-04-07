import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  Plus, 
  MoreVertical, 
  Calendar, 
  Target, 
  Activity,
  ArrowRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ProjectStatus, Project } from '../types';
import { ProjectModal } from './ProjectModal';
import { getPersistentProjects, savePersistentProject } from '../lib/persistence';
import { useAuth } from './AuthContext';

const StatusBadge = ({ status }: { status: ProjectStatus }) => {
  const colors = {
    'Planning': 'bg-blue-50 text-blue-600 border-blue-100',
    'In Progress': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'Paused': 'bg-amber-50 text-amber-600 border-amber-100',
    'Completed': 'bg-slate-50 text-slate-600 border-slate-100',
    'Archived': 'bg-slate-100 text-slate-400 border-slate-200',
  };

  const labels = {
    'Planning': '規劃中',
    'In Progress': '進行中',
    'Paused': '暫停',
    'Completed': '已完成',
    'Archived': '已封存',
  };

  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold border", colors[status])}>
      {labels[status]}
    </span>
  );
};

export const ProjectList = () => {
  const navigate = useNavigate();
  const { user, canAccessProject } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<ProjectStatus | 'All'>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>(undefined);

  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);
      try {
        const data = await getPersistentProjects();
        setProjects(data);
      } catch (error) {
        console.error('Error fetching projects:', error);
        toast.error('讀取專案失敗');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const accessibleProjects = useMemo(() => 
    projects.filter(p => canAccessProject(p.id)),
    [projects, canAccessProject]
  );

  const handleCreateProject = () => {
    if (user?.role !== 'Admin') {
      toast.error('只有管理員可以建立專案');
      return;
    }
    setEditingProject(undefined);
    setIsModalOpen(true);
  };

  const handleEditProject = (project: Project) => {
    if (user?.role !== 'Admin') {
      toast.error('只有管理員可以編輯專案');
      return;
    }
    setEditingProject(project);
    setIsModalOpen(true);
  };

  const handleSaveProject = async (projectData: Omit<Project, 'id' | 'updatedAt'>) => {
    try {
      if (editingProject) {
        const updatedProject: Project = { 
          ...editingProject, 
          ...projectData, 
          updatedAt: new Date().toISOString().split('T')[0] 
        };
        await savePersistentProject(updatedProject);
        setProjects(projects.map(p => p.id === editingProject.id ? updatedProject : p));
        toast.success('專案已更新');
      } else {
        const newProject: Project = {
          ...projectData,
          id: `p${Date.now()}`,
          updatedAt: new Date().toISOString().split('T')[0],
        };
        await savePersistentProject(newProject);
        setProjects([newProject, ...projects]);
        toast.success('專案已建立');
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving project:', error);
      toast.error('儲存失敗');
    }
  };

  const filteredProjects = filter === 'All' 
    ? accessibleProjects 
    : accessibleProjects.filter(p => p.status === filter);

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
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">專案管理</h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">管理您的研發計畫並追蹤進度。</p>
        </div>
        <button 
          onClick={handleCreateProject}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-all shadow-lg shadow-brand-200"
        >
          <Plus className="w-4 h-4" />
          建立專案
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button 
          onClick={() => setFilter('All')}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
            filter === 'All' ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          )}
        >
          全部專案
        </button>
        {(['Planning', 'In Progress', 'Paused', 'Completed', 'Archived'] as ProjectStatus[]).map((s) => {
          const labels = {
            'Planning': '規劃中',
            'In Progress': '進行中',
            'Paused': '暫停',
            'Completed': '已完成',
            'Archived': '已封存',
          };
          return (
            <button 
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                filter === s ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              )}
            >
              {labels[s]}
            </button>
          );
        })}
      </div>

      {/* Project Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredProjects.map((project) => (
          <div key={project.id} className="glass-panel rounded-2xl overflow-hidden group hover:shadow-xl hover:shadow-slate-200 transition-all duration-300 flex flex-col">
            <div className="p-6 flex-1">
              <div className="flex items-start justify-between mb-4">
                <StatusBadge status={project.status} />
                <button 
                  onClick={() => handleEditProject(project)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
              
              <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-brand-600 transition-colors">
                {project.name}
              </h3>
              <p className="text-sm text-slate-500 line-clamp-2 mb-6">
                {project.description}
              </p>

              <div className="space-y-4">
                <div className="flex items-center gap-3 text-slate-600">
                  <Target className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-medium">KPI 目標: {project.kpiTarget}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-medium">開始日期: {project.startDate}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600">
                  <Activity className="w-4 h-4 text-slate-400" />
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full" style={{ width: '45%' }}></div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">45%</span>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                最後更新 {project.updatedAt}
              </span>
              <button 
                onClick={() => {
                  navigate('/experiments');
                  toast.info(`正在查看 ${project.name} 的實驗紀錄`);
                }}
                className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:gap-2 transition-all"
              >
                查看詳情
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}

        {/* Empty State / Add New */}
        <button 
          onClick={handleCreateProject}
          className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 hover:border-brand-300 hover:bg-brand-50 transition-all group min-h-[300px]"
        >
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-brand-100 group-hover:text-brand-600 transition-colors">
            <Plus className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-500 group-hover:text-brand-600">建立新專案</p>
        </button>
      </div>

      <ProjectModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProject}
        initialData={editingProject}
      />
    </div>
  );
};
