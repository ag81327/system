import { Project, Experiment, TestItem, TestResult } from './types';

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'p1',
    name: '新世代聚合物開發專案',
    description: '開發用於航太應用的高強度、輕量化聚合物。',
    status: 'In Progress',
    kpiTarget: '抗拉強度 > 150MPa',
    startDate: '2024-01-15',
    updatedAt: '2024-03-20',
    specs: {
      't1': { min: 140, max: 180, target: 160 },
      't2': { min: 5, max: 15, target: 10 },
      't3': { min: 1.1, max: 1.3, target: 1.2 },
      't4': { min: 0.1, max: 0.5, target: 0.3 }
    }
  },
  {
    id: 'p2',
    name: '環保塗料解決方案',
    description: '零 VOC 排放的水性塗料開發。',
    status: 'Planning',
    kpiTarget: 'VOC 含量 < 1g/L',
    startDate: '2024-04-01',
    updatedAt: '2024-03-25',
    specs: {
      't1': { min: 100, max: 130, target: 115 },
      't2': { min: 20, max: 40, target: 30 },
      't3': { min: 0.9, max: 1.1, target: 1.0 },
      't4': { min: 0.5, max: 1.5, target: 1.0 }
    }
  },
];

export const MOCK_TEST_ITEMS: TestItem[] = [
  { id: 't1', name: '抗拉強度', unit: 'MPa', specMin: 140, specMax: 180, targetValue: 160 },
  { id: 't2', name: '斷裂伸長率', unit: '%', specMin: 5, specMax: 15, targetValue: 10 },
  { id: 't3', name: '密度', unit: 'g/cm³', specMin: 1.1, specMax: 1.3, targetValue: 1.2 },
  { id: 't4', name: '含水率', unit: '%', specMin: 0.1, specMax: 0.5, targetValue: 0.3 },
  { id: 't5', name: '透氧率', unit: 'Dk', specMin: 80, specMax: 120, targetValue: 100 },
];

export const MOCK_EXPERIMENTS: Experiment[] = [
  {
    id: 'e1',
    projectId: 'p1',
    title: '初始催化劑比例測試',
    date: '2026-03-25',
    operator: '史密斯博士',
    observations: '反應在 80°C 時保持穩定。',
    anomalies: '無',
    conclusions: '催化劑 A 顯示出有希望的結果。',
    suggestions: '下一批次建議增加壓力。',
    status: 'Completed',
    formulation: [
      { id: 'f1', materialName: '聚合物基質', batchNumber: 'RM-001', theoreticalWeight: 500, unit: 'g' },
      { id: 'f2', materialName: '催化劑 A', batchNumber: 'RM-002', theoreticalWeight: 15, unit: 'g' },
    ],
    processConditions: [
      { id: 'c1', name: '反應溫度', type: 'Temperature', value: 80, unit: '°C' },
      { id: 'c2', name: '攪拌速度', type: 'Other', value: 300, unit: 'rpm' },
    ]
  },
  {
    id: 'e2',
    projectId: 'p1',
    title: '壓力優化實驗',
    date: '2026-04-01',
    operator: '史密斯博士',
    observations: '高壓導致固化速度加快。',
    anomalies: '觀察到輕微變色。',
    conclusions: '在 5 bar 時發現最佳壓力。',
    suggestions: '測試 UV 穩定性。',
    status: 'Completed',
    formulation: [
      { id: 'f3', materialName: '聚合物基質', batchNumber: 'RM-001', theoreticalWeight: 500, unit: 'g' },
      { id: 'f4', materialName: '催化劑 A', batchNumber: 'RM-002', theoreticalWeight: 15, unit: 'g' },
    ],
    processConditions: [
      { id: 'c3', name: '反應壓力', type: 'Pressure', value: 5, unit: 'bar' },
      { id: 'c4', name: '反應溫度', type: 'Temperature', value: 80, unit: '°C' },
    ]
  },
];

// Helper to generate random test results
export const generateMockResults = (sampleId: string): TestResult[] => {
  return MOCK_TEST_ITEMS.map(item => {
    const rawValues = Array.from({ length: 3 }, () => (item.targetValue || 100) + (Math.random() - 0.5) * 10);
    const mean = rawValues.reduce((a, b) => a + b, 0) / rawValues.length;
    const isAnomaly = (item.specMin !== undefined && mean < item.specMin) || (item.specMax !== undefined && mean > item.specMax);
    
    return {
      id: Math.random().toString(36).substr(2, 9),
      sampleId,
      testItemId: item.id,
      rawValues,
      mean,
      stdDev: Math.sqrt(rawValues.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / rawValues.length),
      max: Math.max(...rawValues),
      min: Math.min(...rawValues),
      isAnomaly,
      status: isAnomaly ? 'Fail' : 'Pass',
    };
  });
};
