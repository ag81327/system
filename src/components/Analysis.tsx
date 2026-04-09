import React, { useState, useMemo, useEffect } from 'react';
import { 
  Download, 
  Share2, 
  Filter, 
  Settings2,
  Maximize2,
  Activity,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  getPersistentProjects, 
  getPersistentTestItems, 
  getPersistentExperiments,
  savePersistentProject
} from '../lib/persistence';
import { Project, TestItem, Experiment } from '../types';
import { useAuth } from './AuthContext';
import { cn } from '../lib/utils';
import { SPCAnalysis } from './SPCAnalysis';
import { CorrelationAnalysis } from './CorrelationAnalysis';
import { SpecificationManager } from './SpecificationManager';

export const Analysis = () => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { canAccessProject } = useAuth();
  
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [testItems, setTestItems] = useState<TestItem[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [projectsData, testItemsData, experimentsData] = await Promise.all([
          getPersistentProjects(),
          getPersistentTestItems(),
          getPersistentExperiments()
        ]);
        setAllProjects(projectsData);
        setTestItems(testItemsData);
        setExperiments(experimentsData);
      } catch (error) {
        console.error('Error fetching analysis data:', error);
        toast.error('讀取數據失敗');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const projects = useMemo(() => 
    allProjects.filter(p => canAccessProject(p.id)),
    [allProjects, canAccessProject]
  );

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedExperimentId, setSelectedExperimentId] = useState('all');
  const [timeRange, setTimeRange] = useState('all');
  const [activeTab, setActiveTab] = useState<'spc' | 'correlation'>('spc');

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const [isSpecModalOpen, setIsSpecModalOpen] = useState(false);
  
  const projectExperiments = useMemo(() => 
    experiments.filter(e => e.projectId === selectedProjectId),
  [experiments, selectedProjectId]);

  const selectedExperiment = useMemo(() => 
    experiments.find(e => e.id === selectedExperimentId),
  [experiments, selectedExperimentId]);

  const selectedProject = useMemo(() => 
    projects.find(p => p.id === selectedProjectId) || projects[0],
  [projects, selectedProjectId]);

  const handleUpdateSpecs = async (projectId: string, updatedSpecs: Record<string, { min?: number; max?: number; target?: number }>) => {
    const updatedProjects = allProjects.map(p => 
      p.id === projectId ? { ...p, specs: updatedSpecs } : p
    );
    try {
      const projectToUpdate = updatedProjects.find(p => p.id === projectId);
      if (projectToUpdate) {
        await savePersistentProject(projectToUpdate);
        setAllProjects(updatedProjects);
        toast.success('專案規格已更新');
      }
    } catch (error) {
      console.error('Error updating specs:', error);
      toast.error('更新規格失敗');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8" ref={containerRef}>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">數據分析中心</h1>
          <p className="text-slate-500 mt-1 text-sm">
            正在分析：<span className="font-bold text-brand-600">{selectedProject?.name}</span>
            {selectedExperiment && (
              <>
                <span className="mx-2 text-slate-300">|</span>
                <span className="font-bold text-indigo-600">{selectedExperiment.title}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button 
            onClick={() => setIsSpecModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs sm:text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Settings2 className="w-4 h-4" />
            規格設定
          </button>
          <button 
            onClick={() => toast.success('數據匯出成功')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-brand-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-brand-700 transition-all shadow-lg shadow-brand-200"
          >
            <Download className="w-4 h-4" />
            匯出
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex items-center gap-4 border-b lg:border-b-0 lg:border-r border-slate-100 pb-4 lg:pb-0 lg:pr-6">
          <button 
            onClick={() => setActiveTab('spc')}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
              activeTab === 'spc' ? "bg-brand-600 text-white shadow-lg shadow-brand-200" : "text-slate-400 hover:bg-slate-50"
            )}
          >
            <Activity className="w-4 h-4" />
            SPC 管制圖
          </button>
          <button 
            onClick={() => setActiveTab('correlation')}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
              activeTab === 'correlation' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-400 hover:bg-slate-50"
            )}
          >
            <TrendingUp className="w-4 h-4" />
            關聯性分析
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 w-fit">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">篩選:</span>
          </div>
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 sm:gap-4 flex-1">
            <select 
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-white border border-slate-200 text-sm font-medium text-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>專案: {p.name}</option>
              ))}
            </select>
            <select 
              value={selectedExperimentId}
              onChange={(e) => setSelectedExperimentId(e.target.value)}
              className="bg-white border border-slate-200 text-sm font-medium text-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">所有實驗</option>
              {projectExperiments.map(exp => (
                <option key={exp.id} value={exp.id}>{exp.title}</option>
              ))}
            </select>
            <select 
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-white border border-slate-200 text-sm font-medium text-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">全部時間</option>
              <option value="30">最近 30 天</option>
              <option value="90">最近 90 天</option>
              <option value="custom">自訂範圍</option>
            </select>
          </div>
          <button 
            onClick={() => {
              setSelectedProjectId(projects[0]?.id || 'p1');
              setSelectedExperimentId('all');
              setTimeRange('30');
              toast.info('篩選條件已重設');
            }}
            className="text-xs font-bold text-brand-600 hover:underline text-right"
          >
            清除全部
          </button>
        </div>
      </div>

      {activeTab === 'spc' ? (
        <SPCAnalysis 
          project={selectedProject}
          experiments={experiments}
          testItems={testItems}
          selectedExperimentId={selectedExperimentId}
          timeRange={timeRange}
        />
      ) : (
        <CorrelationAnalysis 
          project={selectedProject}
          experiments={experiments}
          testItems={testItems}
          selectedExperimentId={selectedExperimentId}
          timeRange={timeRange}
        />
      )}

      {/* Specification Modal */}
      {isSpecModalOpen && selectedProject && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-900">專案規格設定</h3>
                <p className="text-sm text-slate-500">{selectedProject.name}</p>
              </div>
              <button 
                onClick={() => setIsSpecModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Maximize2 className="w-5 h-5 rotate-90" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <SpecificationManager 
                project={selectedProject}
                testItems={testItems}
                onUpdate={handleUpdateSpecs}
              />
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setIsSpecModalOpen(false)}
                className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 transition-all"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
