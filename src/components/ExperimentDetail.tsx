import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  Beaker, 
  Calendar, 
  User, 
  ArrowLeft, 
  Plus, 
  FileText, 
  AlertCircle, 
  CheckCircle2,
  MoreHorizontal,
  Trash2,
  Edit3,
  Settings2,
  FlaskConical,
  Thermometer,
  Save,
  FolderOpen,
  Image as ImageIcon,
  Upload,
  X,
  StickyNote,
  FileEdit
} from 'lucide-react';
import { cn, generateMockResults } from '../lib/utils';
import { DataEntryModal } from './DataEntryModal';
import { ExperimentModal } from './ExperimentModal';
import { RichTextEditor } from './RichTextEditor';
import { SpecificationManager } from './SpecificationManager';
import { useAuth } from './AuthContext';
import { TestItem, Experiment, Project, FormulationItem, ProcessCondition, ProcessConditionType, ProcessProfile, FormulationProfile, Sample, Attachment } from '../types';

import { 
  getPersistentProjects, 
  getPersistentTestItems, 
  savePersistentTestItems, 
  deletePersistentTestItem,
  getPersistentProfiles, 
  savePersistentProfiles,
  getPersistentSamples,
  savePersistentSamples,
  getPersistentFormulationProfiles,
  savePersistentFormulationProfiles,
  getPersistentExperiment,
  savePersistentExperiment,
  savePersistentProject,
  getPersistentAttachments,
  savePersistentAttachment,
  deletePersistentAttachment
} from '../lib/persistence';

export const ExperimentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canAccessExperiment } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [formulation, setFormulation] = useState<FormulationItem[]>([]);
  const [processConditions, setProcessConditions] = useState<ProcessCondition[]>([]);
  const [activeProfileName, setActiveProfileName] = useState<string>('未選擇設定檔');
  const [activeFormulationProfileName, setActiveFormulationProfileName] = useState<string>('未選擇設定檔');
  const [profiles, setProfiles] = useState<ProcessProfile[]>([]);
  const [formulationProfiles, setFormulationProfiles] = useState<FormulationProfile[]>([]);
  const [defectTypes, setDefectTypes] = useState<string[]>(['刮傷', '氣泡', '灰塵', '黑點']);
  const [testItems, setTestItems] = useState<TestItem[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  const handleUpdateExperimentField = async (field: keyof Experiment, value: any) => {
    if (!experiment) return;
    const updatedExp = { ...experiment, [field]: value };
    setExperiment(updatedExp);
    await savePersistentExperiment(updatedExp);
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const [exp, samps, projs, items, profs, fprofs, atts] = await Promise.all([
          getPersistentExperiment(id),
          getPersistentSamples(id),
          getPersistentProjects(),
          getPersistentTestItems(),
          getPersistentProfiles(),
          getPersistentFormulationProfiles(),
          getPersistentAttachments(id)
        ]);

        if (exp) {
          if (!canAccessExperiment(exp.projectId, exp.date)) {
            toast.error('您無權限查看此日期的實驗紀錄');
            navigate('/experiments');
            return;
          }
          setExperiment(exp);
          setFormulation(exp.formulation || []);
          setProcessConditions(exp.processConditions || []);
          setNotes(exp.notes || '');
          setActiveFormulationProfileName(exp.recipeName || '未選擇設定檔');
        } else {
          toast.error('找不到實驗紀錄');
          navigate('/experiments');
          return;
        }

        setSamples(samps);
        setProjects(projs);
        setTestItems(items);
        setProfiles(profs);
        setFormulationProfiles(fprofs);
        setAttachments(atts);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('讀取數據失敗');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, navigate, canAccessExperiment]);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [isExpModalOpen, setIsExpModalOpen] = useState(false);
  const [isSpecModalOpen, setIsSpecModalOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isFormulationProfileDropdownOpen, setIsFormulationProfileDropdownOpen] = useState(false);
  const [activeTestItem, setActiveTestItem] = useState<TestItem | null>(null);
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);

  // Prompt Modal State
  const [promptConfig, setPromptConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'input' | 'confirm' | 'multi-input';
    inputs?: { label: string; value: string; key: string }[];
    onConfirm: (values?: any) => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'input',
    onConfirm: () => {},
  });

  const handleAddFormulation = () => {
    const newItem: FormulationItem = {
      id: `f${Date.now()}`,
      materialName: '',
      batchNumber: '',
      theoreticalWeight: 0,
      actualWeight: undefined,
      unit: 'g'
    };
    setFormulation([...formulation, newItem]);
  };

  const handleUpdateFormulation = (id: string, field: keyof FormulationItem, value: any) => {
    const updatedFormulation = formulation.map(item => item.id === id ? { ...item, [field]: value } : item);
    setFormulation(updatedFormulation);
    if (experiment) {
      const updatedExp = { ...experiment, formulation: updatedFormulation };
      setExperiment(updatedExp);
      savePersistentExperiment(updatedExp);
    }
  };

  const handleRemoveFormulation = (id: string) => {
    const updatedFormulation = formulation.filter(item => item.id !== id);
    setFormulation(updatedFormulation);
    if (experiment) {
      const updatedExp = { ...experiment, formulation: updatedFormulation };
      setExperiment(updatedExp);
      savePersistentExperiment(updatedExp);
    }
  };

  const handleAddCondition = () => {
    const newCondition: ProcessCondition = {
      id: `c${Date.now()}`,
      name: '',
      type: 'Other',
      value: 0,
      unit: ''
    };
    const updatedConditions = [...processConditions, newCondition];
    setProcessConditions(updatedConditions);
    if (experiment) {
      const updatedExp = { ...experiment, processConditions: updatedConditions };
      setExperiment(updatedExp);
      savePersistentExperiment(updatedExp);
    }
  };

  const handleUpdateCondition = async (id: string, field: keyof ProcessCondition, value: any) => {
    const updatedConditions = processConditions.map(c => c.id === id ? { ...c, [field]: value } : c);
    setProcessConditions(updatedConditions);
    if (experiment) {
      const updatedExp = { ...experiment, processConditions: updatedConditions };
      setExperiment(updatedExp);
      await savePersistentExperiment(updatedExp);
    }
  };

  const handleRemoveCondition = async (id: string) => {
    const updatedConditions = processConditions.filter(c => c.id !== id);
    setProcessConditions(updatedConditions);
    if (experiment) {
      const updatedExp = { ...experiment, processConditions: updatedConditions };
      setExperiment(updatedExp);
      await savePersistentExperiment(updatedExp);
    }
  };

  const handleSaveProfile = () => {
    setPromptConfig({
      isOpen: true,
      title: '儲存設定檔',
      message: '請輸入設定檔名稱:',
      type: 'input',
      inputs: [{ label: '名稱', value: '', key: 'name' }],
      onConfirm: async (values) => {
        const name = values.name;
        if (name) {
          const existingProfile = profiles.find(p => p.name === name);
          if (existingProfile) {
            setTimeout(() => {
              setPromptConfig({
                isOpen: true,
                title: '確認覆蓋',
                message: `設定檔 "${name}" 已存在，是否要覆蓋？`,
                type: 'confirm',
                onConfirm: async () => {
                  const updatedProfiles = profiles.map(p => p.id === existingProfile.id ? { ...p, conditions: [...processConditions] } : p);
                  setProfiles(updatedProfiles);
                  await savePersistentProfiles(updatedProfiles);
                  setActiveProfileName(name);
                  toast.success(`設定檔 "${name}" 已更新`);
                }
              });
            }, 100);
            return;
          }

          const newProfile = {
            id: `prof${Date.now()}`,
            name,
            conditions: [...processConditions]
          };
          const updatedProfiles = [...profiles, newProfile];
          setProfiles(updatedProfiles);
          await savePersistentProfiles(updatedProfiles);
          setActiveProfileName(name);
          toast.success(`設定檔 "${name}" 已儲存`);
        }
      }
    });
  };

  const handleLoadProfile = async (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      const newConditions = [...profile.conditions];
      setProcessConditions(newConditions);
      setActiveProfileName(profile.name);
      if (experiment) {
        const updatedExp = { ...experiment, processConditions: newConditions };
        setExperiment(updatedExp);
        await savePersistentExperiment(updatedExp);
      }
      setIsProfileDropdownOpen(false);
      toast.success(`已載入製程設定檔: ${profile.name}`);
    }
  };

  const handleSaveFormulationProfile = () => {
    setPromptConfig({
      isOpen: true,
      title: '儲存配置設定檔',
      message: '請輸入設定檔名稱:',
      type: 'input',
      inputs: [{ label: '名稱', value: '', key: 'name' }],
      onConfirm: async (values) => {
        const name = values.name;
        if (name) {
          const existingProfile = formulationProfiles.find(p => p.name === name);
          if (existingProfile) {
            setTimeout(() => {
              setPromptConfig({
                isOpen: true,
                title: '確認覆蓋',
                message: `設定檔 "${name}" 已存在，是否要覆蓋？`,
                type: 'confirm',
                onConfirm: async () => {
                  const updatedProfiles = formulationProfiles.map(p => p.id === existingProfile.id ? { 
                    ...p, 
                    items: formulation.map(({ materialName, batchNumber, theoreticalWeight, unit }) => ({ materialName, batchNumber, theoreticalWeight, unit })) 
                  } : p);
                  setFormulationProfiles(updatedProfiles);
                  await savePersistentFormulationProfiles(updatedProfiles);
                  setActiveFormulationProfileName(name);
                  toast.success(`配置設定檔 "${name}" 已更新`);
                }
              });
            }, 100);
            return;
          }

          const newProfile: FormulationProfile = {
            id: `fprof${Date.now()}`,
            name,
            items: formulation.map(({ materialName, batchNumber, theoreticalWeight, unit }) => ({ materialName, batchNumber, theoreticalWeight, unit }))
          };
          const updatedProfiles = [...formulationProfiles, newProfile];
          setFormulationProfiles(updatedProfiles);
          await savePersistentFormulationProfiles(updatedProfiles);
          setActiveFormulationProfileName(name);
          toast.success(`配置設定檔 "${name}" 已儲存`);
        }
      }
    });
  };

  const handleLoadFormulationProfile = (profileId: string) => {
    const profile = formulationProfiles.find(p => p.id === profileId);
    if (profile) {
      const newFormulation: FormulationItem[] = profile.items.map((item, index) => ({
        ...item,
        id: `f${Date.now()}${index}`,
        actualWeight: undefined
      }));
      setFormulation(newFormulation);
      setActiveFormulationProfileName(profile.name);
      if (experiment) {
        const updatedExp = { ...experiment, recipeName: profile.name, formulation: newFormulation };
        setExperiment(updatedExp);
        savePersistentExperiment(updatedExp);
      }
      setIsFormulationProfileDropdownOpen(false);
      toast.success(`已載入配置設定檔: ${profile.name}`);
    }
  };

  const handleAddSample = () => {
    const nextCode = `SMP-${(samples.length + 1).toString().padStart(3, '0')}`;
    setPromptConfig({
      isOpen: true,
      title: '新增樣品',
      message: '請輸入樣品資訊:',
      type: 'multi-input',
      inputs: [
        { label: '樣品編號', value: nextCode, key: 'code' },
        { label: '批次', value: 'B1', key: 'batch' },
        { label: '模具批號', value: 'M-001', key: 'moldBatch' }
      ],
      onConfirm: async (values) => {
        const { code, batch, moldBatch } = values;
        if (code && batch) {
          const newId = `s${Date.now()}`;
          const newSample: Sample = {
            id: newId,
            experimentId: id || 'e1',
            sampleCode: code,
            batchNumber: batch,
            moldBatchNumber: moldBatch || '',
            results: generateMockResults(newId, testItems, project?.specs),
            createdAt: new Date().toISOString(),
            gradeA: 0,
            gradeB: 0,
            gradeC: 0,
            defects: []
          };
          const updatedSamples = [...samples, newSample];
          setSamples(updatedSamples);
          await savePersistentSamples(id || 'e1', updatedSamples);
          toast.success('已新增樣品');
        }
      }
    });
  };

  const handleEditSample = (sampleId: string) => {
    const sample = samples.find(s => s.id === sampleId);
    if (sample) {
      setPromptConfig({
        isOpen: true,
        title: '編輯樣品資訊',
        message: '請修改樣品資訊:',
        type: 'multi-input',
        inputs: [
          { label: '樣品編號', value: sample.sampleCode, key: 'code' },
          { label: '批次', value: sample.batchNumber, key: 'batch' },
          { label: '模具批號', value: sample.moldBatchNumber || '', key: 'moldBatch' }
        ],
        onConfirm: async (values) => {
          const { code, batch, moldBatch } = values;
          if (code && batch) {
            const updatedSamples = samples.map(s => s.id === sampleId ? { 
              ...s, 
              sampleCode: code, 
              batchNumber: batch, 
              moldBatchNumber: moldBatch 
            } : s);
            setSamples(updatedSamples);
            await savePersistentSamples(id || 'e1', updatedSamples);
            toast.success('樣品資訊已更新');
          }
        }
      });
    }
  };

  const handleRemoveSample = (sampleId: string) => {
    setPromptConfig({
      isOpen: true,
      title: '刪除樣品',
      message: '確定要刪除此樣品嗎？此動作無法復原。',
      type: 'confirm',
      onConfirm: async () => {
        const updatedSamples = samples.filter(s => s.id !== sampleId);
        setSamples(updatedSamples);
        await savePersistentSamples(id || 'e1', updatedSamples);
        toast.success('樣品已刪除');
      }
    });
  };

  const handleUpdateSampleDefect = async (sampleId: string, type: string, count: number) => {
    const updatedSamples = samples.map(s => {
      if (s.id === sampleId) {
        const defects = s.defects || [];
        const existingDefect = defects.find((d: any) => d.type === type);
        let newDefects;
        if (existingDefect) {
          newDefects = defects.map((d: any) => d.type === type ? { ...d, count } : d);
        } else {
          newDefects = [...defects, { id: Date.now().toString(), type, count }];
        }
        return { ...s, defects: newDefects };
      }
      return s;
    });
    setSamples(updatedSamples);
    await savePersistentSamples(id || 'e1', updatedSamples);
  };

  const handleUpdateSampleGradeCount = async (sampleId: string, grade: 'gradeA' | 'gradeB' | 'gradeC', count: number) => {
    const updatedSamples = samples.map(s => s.id === sampleId ? { ...s, [grade]: count } : s);
    setSamples(updatedSamples);
    await savePersistentSamples(id || 'e1', updatedSamples);
  };

  const handleAddDefectType = () => {
    setPromptConfig({
      isOpen: true,
      title: '新增缺陷種類',
      message: '請輸入新的缺陷種類名稱:',
      type: 'input',
      inputs: [{ label: '名稱', value: '', key: 'name' }],
      onConfirm: (values) => {
        const newType = values.name;
        if (newType && !defectTypes.includes(newType)) {
          setDefectTypes([...defectTypes, newType]);
          toast.success(`已新增缺陷種類: ${newType}`);
        }
      }
    });
  };

  const handleRemoveDefectType = (type: string) => {
    setPromptConfig({
      isOpen: true,
      title: '刪除缺陷種類',
      message: `確定要刪除 "${type}" 嗎？這將會移除所有樣品中的此項紀錄。`,
      type: 'confirm',
      onConfirm: () => {
        setDefectTypes(prev => prev.filter(t => t !== type));
        setSamples(prev => prev.map(s => ({
          ...s,
          defects: (s.defects || []).filter((d: any) => d.type !== type)
        })));
        toast.success(`已刪除缺陷種類: ${type}`);
      }
    });
  };

  const performAddTestItem = async (name: string, unit: string) => {
    const newItem: TestItem = {
      id: `ti${Date.now()}`,
      name,
      unit: unit || ''
    };
    const updatedItems = [...testItems, newItem];
    setTestItems(updatedItems);
    await savePersistentTestItems(updatedItems);
    // Initialize results for existing samples
    const updatedSamples = samples.map(s => ({
      ...s,
      results: [...(s.results || []), {
        id: `res${Date.now()}${s.id}`,
        sampleId: s.id,
        testItemId: newItem.id,
        rawValues: [],
        mean: 0,
        stdDev: 0,
        max: 0,
        min: 0,
        status: 'Pending' as const,
        isAnomaly: false
      }]
    }));
    setSamples(updatedSamples);
    await savePersistentSamples(id || 'e1', updatedSamples);
    toast.success(`已新增測試項目: ${name}`);
  };

  const performAddTestItemFromMaster = async (item: TestItem) => {
    const updatedSamples = samples.map(s => ({
      ...s,
      results: [...(s.results || []), {
        id: `res${Date.now()}${s.id}`,
        sampleId: s.id,
        testItemId: item.id,
        rawValues: [],
        mean: 0,
        stdDev: 0,
        max: 0,
        min: 0,
        status: 'Pending' as const,
        isAnomaly: false
      }]
    }));
    setSamples(updatedSamples);
    await savePersistentSamples(id || 'e1', updatedSamples);
    toast.success(`已加入測試項目: ${item.name}`);
  };

  const performAddTestItemToSample = async (sampleId: string, item: TestItem) => {
    const updatedSamples = samples.map(s => {
      if (s.id === sampleId) {
        return {
          ...s,
          results: [...(s.results || []), {
            id: `res${Date.now()}${s.id}`,
            sampleId: s.id,
            testItemId: item.id,
            rawValues: [],
            mean: 0,
            stdDev: 0,
            max: 0,
            min: 0,
            status: 'Pending' as const,
            isAnomaly: false
          }]
        };
      }
      return s;
    });
    setSamples(updatedSamples);
    await savePersistentSamples(id || 'e1', updatedSamples);
    toast.success(`已為樣品加入測試項目: ${item.name}`);
  };

  const [isTestItemModalOpen, setIsTestItemModalOpen] = useState(false);
  const [isTestItemManagementModalOpen, setIsTestItemManagementModalOpen] = useState(false);

  const handleAddTestItem = () => {
    setIsTestItemModalOpen(true);
  };

  const handleRemoveTestItem = (itemId: string) => {
    const item = testItems.find(t => t.id === itemId);
    setPromptConfig({
      isOpen: true,
      title: '刪除測試項目',
      message: `確定要刪除 "${item?.name}" 嗎？這將會移除所有樣品中的此項數據。`,
      type: 'confirm',
      onConfirm: async () => {
        const updatedItems = testItems.filter(t => t.id !== itemId);
        setTestItems(updatedItems);
        await savePersistentTestItems(updatedItems);
        const updatedSamples = samples.map(s => ({
          ...s,
          results: (s.results || []).filter((r: any) => r.testItemId !== itemId)
        }));
        setSamples(updatedSamples);
        await savePersistentSamples(id || 'e1', updatedSamples);
        toast.success(`已刪除測試項目: ${item?.name}`);
      }
    });
  };

  const handleEditData = (sampleId: string, testItemId: string) => {
    const item = testItems.find(t => t.id === testItemId);
    if (item) {
      setActiveTestItem(item);
      setActiveSampleId(sampleId);
      setIsDataModalOpen(true);
    }
  };

  const handleSaveData = async (newValues: number[]) => {
    if (!activeSampleId || !activeTestItem) return;

    const updatedSamples = samples.map(s => {
      if (s.id === activeSampleId) {
        return {
          ...s,
          results: (s.results || []).map(r => {
            if (r.testItemId === activeTestItem.id) {
              const mean = newValues.reduce((a, b) => a + b, 0) / newValues.length;
              const spec = project?.specs?.[activeTestItem.id];
              const isAnomaly = (spec?.min !== undefined && mean < spec.min) || 
                                (spec?.max !== undefined && mean > spec.max);
              return {
                ...r,
                rawValues: newValues,
                mean,
                stdDev: Math.sqrt(newValues.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / newValues.length),
                max: Math.max(...newValues),
                min: Math.min(...newValues),
                isAnomaly,
                status: isAnomaly ? 'Fail' as const : 'Pass' as const
              };
            }
            return r;
          })
        };
      }
      return s;
    });
    setSamples(updatedSamples);
    await savePersistentSamples(id || 'e1', updatedSamples);
    setIsDataModalOpen(false);
  };

  const handleSaveExperiment = async (expData: Omit<Experiment, 'id'>) => {
    if (!experiment) return;
    const updatedExp = { ...experiment, ...expData, notes };
    setExperiment(updatedExp);
    setActiveFormulationProfileName(updatedExp.recipeName || '未選擇設定檔');
    await savePersistentExperiment(updatedExp);
    toast.success('實驗資訊已更新');
    setIsExpModalOpen(false);
  };

  const handleSaveNotes = async () => {
    if (!experiment) return;
    const updatedExp = { ...experiment, notes };
    setExperiment(updatedExp);
    await savePersistentExperiment(updatedExp);
    setIsEditingNotes(false);
    toast.success('備註已儲存');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    if (file.size > 500 * 1024) { // 500KB limit for base64
      toast.error('檔案過大，請上傳小於 500KB 的圖片');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      const newAttachment: Attachment = {
        id: `att${Date.now()}`,
        parentId: id,
        name: file.name,
        type: file.type,
        size: file.size,
        url: base64String,
        uploadedAt: new Date().toISOString()
      };

      await savePersistentAttachment(newAttachment);
      setAttachments([...attachments, newAttachment]);
      toast.success('檔案已上傳');
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteAttachment = async (attId: string) => {
    await deletePersistentAttachment(attId);
    setAttachments(attachments.filter(a => a.id !== attId));
    toast.success('檔案已刪除');
  };

  const handleUpdateSpecs = async (projectId: string, updatedSpecs: Record<string, { min?: number; max?: number; target?: number }>) => {
    const updatedProjects = projects.map(p => 
      p.id === projectId ? { ...p, specs: updatedSpecs } : p
    );
    setProjects(updatedProjects);
    const updatedProject = updatedProjects.find(p => p.id === projectId);
    if (updatedProject) {
      await savePersistentProject(updatedProject);
    }

    // Update all samples to reflect new specs in their stored status
    const updatedSamples = samples.map(s => ({
      ...s,
      results: (s.results || []).map((r: any) => {
        const spec = updatedSpecs[r.testItemId];
        const isAnomaly = (spec?.min !== undefined && r.mean < spec.min) || 
                          (spec?.max !== undefined && r.mean > spec.max);
        return {
          ...r,
          isAnomaly,
          status: isAnomaly ? 'Fail' : 'Pass'
        };
      })
    }));
    setSamples(updatedSamples);
    await savePersistentSamples(id || 'e1', updatedSamples);

    toast.success('專案規格已更新');
  };

  if (isLoading || !experiment) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  const project = projects.find(p => p.id === experiment.projectId);

  return (
    <div className="space-y-8 pb-20">
      {/* Breadcrumbs & Actions */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate('/experiments')}
          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回實驗列表
        </button>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsSpecModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Settings2 className="w-4 h-4" />
            專案規格設定
          </button>
          <button 
            onClick={() => toast.info('更多選項開發中')}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setIsExpModalOpen(true)}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
          >
            編輯實驗
          </button>
          <button 
            onClick={async () => {
              if (!experiment) return;
              const updatedExp: Experiment = { ...experiment, status: 'Completed' };
              setExperiment(updatedExp);
              await savePersistentExperiment(updatedExp);
              toast.success('實驗已標記為完成');
            }}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-all shadow-lg shadow-brand-200"
          >
            完成實驗
          </button>
        </div>
      </div>

      {/* ... rest of the component ... */}
      
      {isSpecModalOpen && project && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">專案規格設定</h3>
                <p className="text-sm text-slate-500">{project.name}</p>
              </div>
              <button 
                onClick={() => setIsSpecModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 rotate-90" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <SpecificationManager 
                project={project}
                testItems={testItems}
                onUpdate={handleUpdateSpecs}
                onAddTestItem={performAddTestItem}
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

      {/* Header Info */}
      <div className="glass-panel p-8 rounded-2xl">
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 bg-brand-50 text-brand-600 text-[10px] font-bold rounded uppercase tracking-wider border border-brand-100">
                {project?.name || '未知專案'}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-sm font-medium text-slate-500">ID: {experiment.id}</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900">{experiment.title}</h1>
          </div>
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold",
            experiment.status === 'Completed' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
          )}>
            {experiment.status === 'Completed' ? <CheckCircle2 className="w-4 h-4" /> : <Beaker className="w-4 h-4" />}
            {experiment.status === 'Completed' ? '已完成' : '草稿'}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">日期</p>
              <p className="text-sm font-medium text-slate-900">{experiment.date}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
              <User className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">實驗人員</p>
              <p className="text-sm font-medium text-slate-900">{experiment.operator}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">配方名稱</p>
              <p className="text-sm font-medium text-slate-900">{experiment.recipeName || '未設定'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Observations & Conclusions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-panel p-8 rounded-2xl">
          <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-500" />
            實驗觀察與結論
          </h2>
          <div className="space-y-6">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">實驗觀察</h4>
              <textarea
                value={experiment.observations || ''}
                onChange={(e) => handleUpdateExperimentField('observations', e.target.value)}
                placeholder="輸入實驗觀察..."
                rows={4}
                className="w-full text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all resize-none"
              />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">結論</h4>
              <textarea
                value={experiment.conclusions || ''}
                onChange={(e) => handleUpdateExperimentField('conclusions', e.target.value)}
                placeholder="輸入實驗結論..."
                rows={4}
                className="w-full text-sm text-slate-700 leading-relaxed bg-brand-50/30 p-4 rounded-xl border border-brand-100 focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all resize-none"
              />
            </div>
          </div>
        </div>

        <div className="glass-panel p-8 rounded-2xl">
          <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            異常說明與建議
          </h2>
          <div className="space-y-6">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">異常說明</h4>
              <textarea
                value={experiment.anomalies || ''}
                onChange={(e) => handleUpdateExperimentField('anomalies', e.target.value)}
                placeholder="輸入異常說明..."
                rows={4}
                className="w-full text-sm text-slate-700 leading-relaxed bg-amber-50/30 p-4 rounded-xl border border-amber-100 focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all resize-none"
              />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">後續建議</h4>
              <textarea
                value={experiment.suggestions || ''}
                onChange={(e) => handleUpdateExperimentField('suggestions', e.target.value)}
                placeholder="輸入後續建議..."
                rows={4}
                className="w-full text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Formulation & Process Conditions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Formulation Table */}
        <div className="glass-panel p-8 rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-brand-500" />
                配置紀錄表格
              </h2>
              <p className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded w-fit">
                配方名稱: {activeFormulationProfileName}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <button 
                  onClick={() => setIsFormulationProfileDropdownOpen(!isFormulationProfileDropdownOpen)}
                  className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  <FolderOpen className="w-3 h-3" /> 載入設定檔
                </button>
                {isFormulationProfileDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsFormulationProfileDropdownOpen(false)}
                    ></div>
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden">
                      {formulationProfiles.map(p => (
                        <button 
                          key={p.id}
                          onClick={() => handleLoadFormulationProfile(p.id)}
                          className="w-full text-left px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 border-b border-slate-50 last:border-none"
                        >
                          {p.name}
                        </button>
                      ))}
                      {formulationProfiles.length === 0 && (
                        <div className="px-4 py-3 text-[10px] text-slate-400 italic">無可用設定檔</div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <button 
                onClick={handleSaveFormulationProfile}
                className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline"
              >
                <Save className="w-3 h-3" /> 儲存設定檔
              </button>
              <button 
                onClick={handleAddFormulation}
                className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline"
              >
                <Plus className="w-3 h-3" /> 新增材料
              </button>
            </div>
          </div>
          <div className="overflow-x-auto pb-2 custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">材料名稱</th>
                  <th className="py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">批號</th>
                  <th className="py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">理論重量</th>
                  <th className="py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">實際重量</th>
                  <th className="py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {formulation.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 pr-4">
                      <input 
                        type="text" 
                        value={item.materialName}
                        onChange={(e) => handleUpdateFormulation(item.id, 'materialName', e.target.value)}
                        placeholder="材料名稱..."
                        className="w-full bg-transparent border-none focus:ring-0 text-sm text-slate-700 p-0"
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <input 
                        type="text" 
                        value={item.batchNumber}
                        onChange={(e) => handleUpdateFormulation(item.id, 'batchNumber', e.target.value)}
                        placeholder="批號..."
                        className="w-full bg-transparent border-none focus:ring-0 text-sm text-slate-700 p-0"
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          value={item.theoreticalWeight}
                          onChange={(e) => handleUpdateFormulation(item.id, 'theoreticalWeight', parseFloat(e.target.value))}
                          className="w-16 bg-transparent border-none focus:ring-0 text-sm text-slate-700 p-0 text-right"
                        />
                        <span className="text-xs text-slate-400">{item.unit}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-1 bg-brand-50/50 rounded px-2 py-1">
                        <input 
                          type="number" 
                          value={item.actualWeight || ''}
                          onChange={(e) => handleUpdateFormulation(item.id, 'actualWeight', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                          placeholder="輸入重量"
                          className="w-16 bg-transparent border-none focus:ring-0 text-sm font-bold text-brand-600 p-0 text-right"
                        />
                        <span className="text-[10px] text-brand-400">{item.unit}</span>
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      <button 
                        onClick={() => handleRemoveFormulation(item.id)}
                        className="text-slate-300 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {formulation.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-400 italic">尚未新增配置紀錄</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Process Conditions */}
        <div className="glass-panel p-8 rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Thermometer className="w-5 h-5 text-indigo-500" />
                製程條件
              </h2>
              <p className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded w-fit">
                目前設定檔: {activeProfileName}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <button 
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  <FolderOpen className="w-3 h-3" /> 載入設定檔
                </button>
                {isProfileDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsProfileDropdownOpen(false)}
                    ></div>
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden">
                      {profiles.map(p => (
                        <button 
                          key={p.id}
                          onClick={() => handleLoadProfile(p.id)}
                          className="w-full text-left px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 border-b border-slate-50 last:border-none"
                        >
                          {p.name}
                        </button>
                      ))}
                      {profiles.length === 0 && (
                        <div className="px-4 py-3 text-[10px] text-slate-400 italic">無可用設定檔</div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <button 
                onClick={handleSaveProfile}
                className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline"
              >
                <Save className="w-3 h-3" /> 儲存設定檔
              </button>
              <button 
                onClick={handleAddCondition}
                className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline"
              >
                <Plus className="w-3 h-3" /> 新增條件
              </button>
            </div>
          </div>
          <div className="space-y-3 overflow-x-auto pb-2 custom-scrollbar">
            {processConditions.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 min-w-[500px] sm:min-w-0">
                <input 
                  type="text" 
                  value={c.name}
                  onChange={(e) => handleUpdateCondition(c.id, 'name', e.target.value)}
                  placeholder="條件名稱"
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 p-0"
                />
                <select 
                  value={c.type}
                  onChange={(e) => handleUpdateCondition(c.id, 'type', e.target.value as ProcessConditionType)}
                  className="bg-white border border-slate-200 rounded text-[10px] px-2 py-1 outline-none"
                >
                  <option value="Energy">能量參數</option>
                  <option value="Time">時間參數</option>
                  <option value="Concentration">濃度參數</option>
                  <option value="Temperature">溫度參數</option>
                  <option value="Pressure">壓力參數</option>
                  <option value="Other">其他參數</option>
                </select>
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-1">
                  <input 
                    type="number" 
                    value={c.value}
                    onChange={(e) => handleUpdateCondition(c.id, 'value', parseFloat(e.target.value))}
                    className="w-12 bg-transparent border-none focus:ring-0 text-xs text-slate-700 p-0 text-right"
                  />
                  <input 
                    type="text" 
                    value={c.unit}
                    onChange={(e) => handleUpdateCondition(c.id, 'unit', e.target.value)}
                    placeholder="單位"
                    className="w-8 bg-transparent border-none focus:ring-0 text-[10px] text-slate-400 p-0"
                  />
                </div>
                <button 
                  onClick={() => handleRemoveCondition(c.id)}
                  className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {processConditions.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400 italic">尚未設定製程條件</div>
            )}
          </div>
        </div>
      </div>

      {/* Notes Section */}
      <div className="grid grid-cols-1 gap-8">
        <div className="glass-panel p-8 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
                <FileEdit className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">實驗備註</h2>
                <p className="text-xs text-slate-500">在此排版實驗過程、觀察結果與插入圖片。</p>
              </div>
            </div>
            <button 
              onClick={() => isEditingNotes ? handleSaveNotes() : setIsEditingNotes(true)}
              className={cn(
                "px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2",
                isEditingNotes ? "bg-brand-600 text-white hover:bg-brand-700 shadow-brand-100" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {isEditingNotes ? (
                <>
                  <Save className="w-4 h-4" />
                  儲存備註
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4" />
                  編輯備註
                </>
              )}
            </button>
          </div>
          
          {isEditingNotes ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <RichTextEditor 
                content={notes} 
                onChange={setNotes}
                placeholder="在此輸入實驗詳細備註，可直接貼上圖片或使用工具列插入圖片..."
              />
              <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <AlertCircle className="w-4 h-4 text-brand-500" />
                <p>提示：您可以直接從剪貼簿貼上圖片，或點擊工具列的圖片圖示上傳。圖片將直接嵌入文章中。</p>
              </div>
            </div>
          ) : (
            <div className="prose prose-slate max-w-none bg-slate-50/30 p-8 rounded-2xl border border-slate-100 min-h-[300px] shadow-inner">
              {notes ? (
                <div 
                  className="rich-text-content"
                  dangerouslySetInnerHTML={{ __html: notes }} 
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4 opacity-50">
                    <StickyNote className="w-8 h-8" />
                  </div>
                  <p className="font-medium">尚無備註內容</p>
                  <p className="text-sm opacity-70 mt-1">點擊右上角的「編輯備註」按鈕開始撰寫實驗報告。</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Attachments Section */}
      <div className="glass-panel p-8 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">實驗附件管理</h2>
              <p className="text-xs text-slate-500">管理實驗相關的原始圖檔與文件。</p>
            </div>
          </div>
          <label className="cursor-pointer px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
            <Upload className="w-4 h-4" />
            上傳附件
            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
          </label>
        </div>

        {attachments.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {attachments.map(att => (
              <div key={att.id} className="group relative aspect-square rounded-xl overflow-hidden border border-slate-100 bg-slate-50 shadow-sm hover:shadow-md transition-all">
                {att.type.startsWith('image/') ? (
                  <img 
                    src={att.url} 
                    alt={att.name} 
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                    <FileText className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-[10px] font-medium text-slate-500 truncate w-full">{att.name}</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button 
                    onClick={() => window.open(att.url, '_blank')}
                    className="p-2 bg-white rounded-lg text-slate-900 hover:bg-slate-100 transition-colors shadow-lg"
                    title="查看原圖"
                  >
                    <FolderOpen className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDeleteAttachment(att.id)}
                    className="p-2 bg-red-500 rounded-lg text-white hover:bg-red-600 transition-colors shadow-lg"
                    title="刪除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-2xl">
            <ImageIcon className="w-12 h-12 mb-2 opacity-20 mx-auto" />
            <p className="text-sm text-slate-400">尚未上傳任何附件。</p>
          </div>
        )}
      </div>

      {/* Samples & Results */}
      <div className="space-y-12">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">樣品分析與紀錄</h2>
          <button 
            onClick={handleAddSample}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-all shadow-lg shadow-brand-200"
          >
            <Plus className="w-4 h-4" />
            新增樣品
          </button>
        </div>

        {/* 1. Lens Characteristic Analysis */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-brand-500 rounded-full"></div>
              <h3 className="text-xl font-bold text-slate-900">鏡片特性分析</h3>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsTestItemManagementModalOpen(true)}
                className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline"
              >
                <Settings2 className="w-3 h-3" /> 測試項目管理
              </button>
              <button 
                onClick={handleAddTestItem}
                className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-brand-600"
              >
                <Plus className="w-3 h-3" /> 新增測試項目
              </button>
            </div>
          </div>

          {samples.map((sample, sIdx) => (
            <div key={sample.id} className="glass-panel rounded-2xl overflow-hidden">
              <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">樣品編號</p>
                    <p className="text-sm font-bold text-slate-900">{sample.sampleCode}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">批次</p>
                    <p className="text-sm font-medium text-slate-600">{sample.batchNumber}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">模具批號</p>
                    <p className="text-sm font-medium text-slate-600">{sample.moldBatchNumber || '-'}</p>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <button 
                    onClick={() => handleEditSample(sample.id)}
                    className="p-2 text-slate-400 hover:text-brand-600 hover:bg-white rounded-lg transition-all"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleRemoveSample(sample.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">測試項目</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">原始量測值</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">平均值</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">標準差</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">LSL</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">目標值</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">USL</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">狀態</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sample.results?.map((result: any) => {
                      const testItem = testItems.find(t => t.id === result.testItemId);
                      if (!testItem) return null;
                      const spec = project?.specs?.[result.testItemId];
                      return (
                        <tr key={result.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 group">
                              <div>
                                <p className="text-sm font-bold text-slate-900">{testItem?.name}</p>
                                <p className="text-[10px] text-slate-400">單位: {testItem?.unit}</p>
                              </div>
                              <button 
                                onClick={() => handleRemoveTestItem(testItem.id)}
                                className="p-1 text-slate-300 hover:text-rose-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-1">
                              {result.rawValues.map((v: number, i: number) => (
                                <span key={i} className="px-2 py-1 bg-slate-100 rounded text-[10px] font-mono text-slate-600">
                                  {v.toFixed(2)}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-sm font-bold text-slate-900">{result.mean.toFixed(2)}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-xs text-slate-500">{result.stdDev.toFixed(3)}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-xs font-medium text-slate-600">{spec?.min ?? '-'}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-xs font-medium text-slate-600">{spec?.target ?? '-'}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-xs font-medium text-slate-600">{spec?.max ?? '-'}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {(() => {
                              const isPass = (spec?.min === undefined || result.mean >= spec.min) && 
                                             (spec?.max === undefined || result.mean <= spec.max);
                              return (
                                <span className={cn(
                                  "px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                                  isPass ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
                                )}>
                                  {isPass ? '合格' : '不合格'}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleEditData(sample.id, result.testItemId)}
                              className="text-xs font-bold text-brand-600 hover:underline"
                            >
                              編輯數據
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* 2. Lens Defect Statistical Record */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-rose-500 rounded-full"></div>
              <h3 className="text-xl font-bold text-slate-900">鏡片缺陷統計紀錄</h3>
            </div>
            <button 
              onClick={handleAddDefectType}
              className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-brand-600"
            >
              <Plus className="w-3 h-3" /> 自定義缺陷種類
            </button>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">樣品編號</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-emerald-600 uppercase tracking-wider text-center bg-emerald-50/30">A級數量</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-amber-600 uppercase tracking-wider text-center bg-amber-50/30">B級數量</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-rose-600 uppercase tracking-wider text-center bg-rose-50/30">C級數量</th>
                    {defectTypes.map(type => (
                      <th key={type} className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
                        <div className="flex flex-col items-center gap-1 group">
                          <span>{type}</span>
                          <button 
                            onClick={() => handleRemoveDefectType(type)}
                            className="p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {samples.map((sample) => (
                    <tr key={sample.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-900">{sample.sampleCode}</span>
                      </td>
                      <td className="px-6 py-4 text-center bg-emerald-50/10">
                        <input 
                          type="number" 
                          min="0"
                          value={sample.gradeA || 0}
                          onChange={(e) => handleUpdateSampleGradeCount(sample.id, 'gradeA', parseInt(e.target.value) || 0)}
                          className="w-12 text-center bg-white border border-emerald-200 rounded text-xs py-1 outline-none focus:border-emerald-500 font-bold text-emerald-600"
                        />
                      </td>
                      <td className="px-6 py-4 text-center bg-amber-50/10">
                        <input 
                          type="number" 
                          min="0"
                          value={sample.gradeB || 0}
                          onChange={(e) => handleUpdateSampleGradeCount(sample.id, 'gradeB', parseInt(e.target.value) || 0)}
                          className="w-12 text-center bg-white border border-amber-200 rounded text-xs py-1 outline-none focus:border-amber-500 font-bold text-amber-600"
                        />
                      </td>
                      <td className="px-6 py-4 text-center bg-rose-50/10">
                        <input 
                          type="number" 
                          min="0"
                          value={sample.gradeC || 0}
                          onChange={(e) => handleUpdateSampleGradeCount(sample.id, 'gradeC', parseInt(e.target.value) || 0)}
                          className="w-12 text-center bg-white border border-rose-200 rounded text-xs py-1 outline-none focus:border-rose-500 font-bold text-rose-600"
                        />
                      </td>
                      {defectTypes.map(type => {
                        const defect = sample.defects?.find((d: any) => d.type === type);
                        return (
                          <td key={type} className="px-6 py-4 text-center">
                            <input 
                              type="number" 
                              min="0"
                              value={defect?.count || 0}
                              onChange={(e) => handleUpdateSampleDefect(sample.id, type, parseInt(e.target.value) || 0)}
                              className="w-12 text-center bg-slate-50 border border-slate-200 rounded text-xs py-1 outline-none focus:border-brand-500"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50/50 font-bold">
                  <tr>
                    <td className="px-6 py-4 text-sm text-slate-900 text-right">總計：</td>
                    <td className="px-6 py-4 text-center text-sm text-emerald-600 bg-emerald-50/30">
                      {samples.reduce((sum, s) => sum + (s.gradeA || 0), 0)}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-amber-600 bg-amber-50/30">
                      {samples.reduce((sum, s) => sum + (s.gradeB || 0), 0)}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-rose-600 bg-rose-50/30">
                      {samples.reduce((sum, s) => sum + (s.gradeC || 0), 0)}
                    </td>
                    {defectTypes.map(type => {
                      const total = samples.reduce((sum, s) => sum + (s.defects?.find((d: any) => d.type === type)?.count || 0), 0);
                      return (
                        <td key={type} className="px-6 py-4 text-center text-sm text-brand-600">
                          {total}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>

      {activeTestItem && (
        <DataEntryModal 
          isOpen={isDataModalOpen}
          onClose={() => setIsDataModalOpen(false)}
          testItem={activeTestItem}
          specMin={project?.specs?.[activeTestItem.id]?.min}
          specMax={project?.specs?.[activeTestItem.id]?.max}
          targetValue={project?.specs?.[activeTestItem.id]?.target}
          onSave={handleSaveData}
          initialValues={samples.find(s => s.id === activeSampleId)?.results.find(r => r.testItemId === activeTestItem.id)?.rawValues}
        />
      )}

      <ExperimentModal 
        isOpen={isExpModalOpen}
        onClose={() => setIsExpModalOpen(false)}
        onSave={handleSaveExperiment}
        initialData={experiment}
      />

      {/* Test Item Selection Modal */}
      {isTestItemModalOpen && (
        <TestItemAddModal 
          isOpen={isTestItemModalOpen}
          onClose={() => setIsTestItemModalOpen(false)}
          testItems={testItems}
          onSelectExisting={async (item) => {
            await performAddTestItemFromMaster(item);
            setIsTestItemModalOpen(false);
          }}
        />
      )}

      {/* Test Item Management Modal */}
      {isTestItemManagementModalOpen && (
        <TestItemManagementModal
          isOpen={isTestItemManagementModalOpen}
          onClose={() => setIsTestItemManagementModalOpen(false)}
          testItems={testItems}
          onCreateNew={async (name, unit) => {
            await performAddTestItem(name, unit);
          }}
          onUpdateItem={async (itemId, name, unit) => {
            try {
              const oldItem = testItems.find(t => t.id === itemId);
              if (!oldItem) return;

              // 1. Update master list
              const updatedItems = testItems.map(t => 
                t.id === itemId ? { ...t, name, unit } : t
              );
              setTestItems(updatedItems);
              await savePersistentTestItems(updatedItems);

              // 2. Update all projects' specifications
              const updatedProjects = projects.map(proj => {
                if (!proj.specs || !proj.specs[itemId]) return proj;
                return {
                  ...proj,
                  specs: {
                    ...proj.specs,
                    [itemId]: { ...proj.specs[itemId], name, unit }
                  }
                };
              });
              
              for (const proj of updatedProjects) {
                const originalProj = projects.find(p => p.id === proj.id);
                if (proj.specs !== originalProj?.specs) {
                  await savePersistentProject(proj);
                }
              }
              setProjects(updatedProjects);

              // 3. Update current experiment and samples if they use this item
              // (The item name/unit in samples is usually derived from testItems, but if it's stored, we update it)
              toast.success(`測試項目 "${name}" 已更新`);
            } catch (error) {
              console.error('Failed to update test item:', error);
              toast.error('更新失敗');
            }
          }}
          onDeleteItem={async (itemId) => {
            const item = testItems.find(t => t.id === itemId);
            if (!item) return;
            
            setPromptConfig({
              isOpen: true,
              title: '永久刪除測試項目',
              message: `確定要從系統中永久刪除 "${item.name}" 嗎？\n這將會移除所有專案規格中的此項設定。`,
              type: 'confirm',
              onConfirm: async () => {
                try {
                  // Find all items with the same name to clean up duplicates
                  const itemsToDelete = testItems.filter(t => t.name === item.name);
                  const idsToDelete = itemsToDelete.map(t => t.id);
                  
                  // 1. Delete from master list
                  await Promise.all(idsToDelete.map(t => deletePersistentTestItem(t)));
                  
                  // 2. Clean up from all projects' specifications
                  const updatedProjects = projects.map(proj => {
                    if (!proj.specs) return proj;
                    
                    let hasChanges = false;
                    const newSpecs = { ...proj.specs };
                    
                    idsToDelete.forEach(id => {
                      if (newSpecs[id]) {
                        delete newSpecs[id];
                        hasChanges = true;
                      }
                    });
                    
                    return hasChanges ? { ...proj, specs: newSpecs } : proj;
                  });
                  
                  // Save updated projects to persistence
                  for (const proj of updatedProjects) {
                    const originalProj = projects.find(p => p.id === proj.id);
                    if (proj.specs !== originalProj?.specs) {
                      await savePersistentProject(proj);
                    }
                  }
                  
                  setProjects(updatedProjects);
                  
                  // 3. Update master list in state and persistence
                  const finalMasterItems = testItems.filter(t => t.name !== item.name);
                  setTestItems(finalMasterItems);
                  await savePersistentTestItems(finalMasterItems);
                  
                  toast.success(`已從系統徹底刪除測試項目 "${item.name}" 並清理相關專案設定`);
                } catch (error) {
                  console.error('Failed to delete test item(s):', error);
                  toast.error('刪除失敗');
                }
              }
            });
          }}
        />
      )}

      {/* Generic Prompt Modal */}
      {promptConfig.isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">{promptConfig.title}</h3>
              <p className="text-sm text-slate-500 mt-1">{promptConfig.message}</p>
            </div>
            <div className="p-6 space-y-4">
              {promptConfig.type !== 'confirm' && promptConfig.inputs?.map((input, idx) => (
                <div key={idx}>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    {input.label}
                  </label>
                  <input
                    type="text"
                    autoFocus={idx === 0}
                    value={input.value}
                    onChange={(e) => {
                      const newInputs = [...(promptConfig.inputs || [])];
                      newInputs[idx].value = e.target.value;
                      setPromptConfig({ ...promptConfig, inputs: newInputs });
                    }}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  />
                </div>
              ))}
              {promptConfig.type === 'confirm' && (
                <div className="flex items-center gap-3 p-4 bg-rose-50 rounded-xl border border-rose-100">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  <p className="text-sm text-rose-700 font-medium">此操作無法撤銷，請確認是否繼續。</p>
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setPromptConfig({ ...promptConfig, isOpen: false })}
                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  const values: any = {};
                  promptConfig.inputs?.forEach(input => {
                    values[input.key] = input.value;
                  });
                  promptConfig.onConfirm(values);
                  setPromptConfig({ ...promptConfig, isOpen: false });
                }}
                className={cn(
                  "px-6 py-2 rounded-lg text-sm font-bold text-white transition-all shadow-lg",
                  promptConfig.type === 'confirm' ? "bg-rose-500 hover:bg-rose-600 shadow-rose-200" : "bg-brand-600 hover:bg-brand-700 shadow-brand-200"
                )}
              >
                確認
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface TestItemAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  testItems: TestItem[];
  onSelectExisting: (item: TestItem) => Promise<void>;
}

const TestItemAddModal = ({ isOpen, onClose, testItems, onSelectExisting }: TestItemAddModalProps) => {
  const [selectedId, setSelectedId] = useState('');

  // Filter unique test items by name for the dropdown
  const uniqueTestItems = useMemo(() => {
    const seen = new Set();
    return testItems.filter(item => {
      if (seen.has(item.name)) return false;
      seen.add(item.name);
      return true;
    });
  }, [testItems]);

  if (!isOpen) return null;

  const handleSelect = async () => {
    if (!selectedId) {
      toast.error('請先選擇一個項目');
      return;
    }
    const item = testItems.find(t => t.id === selectedId);
    if (item) {
      await onSelectExisting(item);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">新增測試項目</h3>
            <p className="text-xs text-slate-500 mt-1">從現有項目庫中選取要加入此實驗的項目。</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">選擇現有項目</label>
            <select 
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-brand-500 outline-none transition-all"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">請選擇...</option>
              {uniqueTestItems.map(item => (
                <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
              ))}
            </select>
            <button 
              onClick={handleSelect}
              disabled={!selectedId}
              className="w-full py-3 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-200 disabled:opacity-50 disabled:shadow-none mt-2"
            >
              確認加入
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface TestItemManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  testItems: TestItem[];
  onCreateNew: (name: string, unit: string) => Promise<void>;
  onUpdateItem: (itemId: string, name: string, unit: string) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
}

const TestItemManagementModal = ({ isOpen, onClose, testItems, onCreateNew, onUpdateItem, onDeleteItem }: TestItemManagementModalProps) => {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter unique test items by name for the list
  const uniqueTestItems = useMemo(() => {
    const seen = new Set();
    return testItems.filter(item => {
      if (seen.has(item.name)) return false;
      seen.add(item.name);
      return true;
    });
  }, [testItems]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!name) {
      toast.error('請輸入項目名稱');
      return;
    }
    setIsSubmitting(true);
    if (editingId) {
      await onUpdateItem(editingId, name, unit);
      setEditingId(null);
    } else {
      await onCreateNew(name, unit);
    }
    setName('');
    setUnit('');
    setIsSubmitting(false);
  };

  const startEdit = (item: TestItem) => {
    setEditingId(item.id);
    setName(item.name);
    setUnit(item.unit || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setUnit('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900">測試項目管理</h3>
            <p className="text-xs text-slate-500 mt-1">管理系統中所有可用的測試項目及其單位。</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Create/Edit Section */}
          <div className={cn(
            "p-6 rounded-2xl border transition-all space-y-4",
            editingId ? "bg-amber-50/30 border-amber-100" : "bg-brand-50/30 border-brand-100"
          )}>
            <h4 className={cn(
              "text-sm font-bold flex items-center gap-2",
              editingId ? "text-amber-900" : "text-brand-900"
            )}>
              {editingId ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />} 
              {editingId ? '編輯測試項目' : '建立新測試項目'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">項目名稱</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如: 拉伸強度"
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">單位</label>
                <input 
                  type="text" 
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="例如: MPa"
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handleCreate}
                disabled={isSubmitting || !name}
                className={cn(
                  "flex-1 py-2.5 text-white rounded-xl text-sm font-bold transition-all shadow-lg disabled:opacity-50",
                  editingId ? "bg-amber-500 hover:bg-amber-600 shadow-amber-200" : "bg-brand-600 hover:bg-brand-700 shadow-brand-200"
                )}
              >
                {isSubmitting ? '處理中...' : editingId ? '儲存修改' : '建立並加入系統庫'}
              </button>
              {editingId && (
                <button 
                  onClick={cancelEdit}
                  className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
                >
                  取消編輯
                </button>
              )}
            </div>
          </div>

          {/* Existing Items List */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-slate-400" /> 系統現有項目庫 ({uniqueTestItems.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {uniqueTestItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-brand-200 transition-all group">
                  <div>
                    <p className="text-sm font-bold text-slate-700">{item.name}</p>
                    <p className="text-[10px] text-slate-400">單位: {item.unit || '無'}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => startEdit(item)}
                      className="p-2 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all"
                      title="編輯"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onDeleteItem(item.id)}
                      className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      title="刪除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {uniqueTestItems.length === 0 && (
                <div className="col-span-full py-8 text-center text-xs text-slate-400 italic">尚未建立任何測試項目</div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};
