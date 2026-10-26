import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { 
  X, 
  Download, 
  Printer, 
  Plus, 
  Trash2, 
  FileSpreadsheet, 
  Layers, 
  Sliders, 
  Info,
  Maximize2,
  Minimize2,
  ChevronDown,
  FileDown,
  Loader2,
  Database
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Experiment, Sample, TestItem, DefectMaster } from '../types';
import { getPersistentSamples, getPersistentTestItems, getPersistentDefectMasters } from '../lib/persistence';

export interface ReportRow {
  id: string;
  sampleCode: string;
  dia: string | number;
  bc: string | number;
  ct: string | number;
  et1: string | number;
  et2: string | number;
  et3: string | number;
  et4: string | number;
  power: string | number; // 度數 (D)
  defects: Record<string, number>; // 動態缺陷字典: { '雙邊': 1, '凹頂': 0, ... }
  gradeA: string | number; // A級 合格片
  gradeB: string | number; // B級 合格片
  gradeC: string | number; // C級 不良片
}

export interface ReportBlock {
  experimentId: string;
  experimentTitle: string;
  batchNumber: string;        // 生產批號
  measureDate: string;        // 量測日期
  moldBatchNumber: string;    // 模具批號
  operator: string;           // 檢測人員
  formulationName: string;    // 材料名稱/批次
  prepareTime: string;        // 配置時間
  curingEquipment: string;    // 固化設備
  curingEnergy: string;       // 固化能量
  defectColumns: string[];    // 該實驗實際擁有的缺陷種類欄位清單
  rows: ReportRow[];
}

export interface CandidateDefect {
  name: string;
  code?: string;
  severity?: 'Minor' | 'Major' | 'Critical';
  description?: string;
  source: 'master' | 'sample' | 'preset';
}

interface DataSummaryExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  experiments: Experiment[];
  initialExperimentId?: string;
}

export const DataSummaryExportModal: React.FC<DataSummaryExportModalProps> = ({
  isOpen,
  onClose,
  experiments,
  initialExperimentId
}) => {
  const [reportBlocks, setReportBlocks] = useState<ReportBlock[]>([]);
  const [activeExpId, setActiveExpId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportMode, setExportMode] = useState<'multi-sheet' | 'single-sheet'>('multi-sheet');
  const [includeSummaryRow, setIncludeSummaryRow] = useState<boolean>(true);
  const [previewAllStacked, setPreviewAllStacked] = useState<boolean>(false);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [isExportModeModalOpen, setIsExportModeModalOpen] = useState<boolean>(false);

  // 基礎資料設定中的「缺陷與等級定義」主檔
  const [dbDefectMasters, setDbDefectMasters] = useState<DefectMaster[]>([]);
  // 樣品中出現過的所有缺陷名稱
  const [allRecordedDefects, setAllRecordedDefects] = useState<string[]>([]);
  
  const [defectDropdownOpenFor, setDefectDropdownOpenFor] = useState<string | null>(null);
  const [defectSearchText, setDefectSearchText] = useState<string>('');
  const defectDropdownRef = useRef<HTMLDivElement>(null);

  // 點擊外部關閉缺陷下拉選單
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (defectDropdownRef.current && !defectDropdownRef.current.contains(e.target as Node)) {
        setDefectDropdownOpenFor(null);
        setDefectSearchText('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 載入基礎資料設定中的缺陷主檔與樣品數據
  useEffect(() => {
    if (!isOpen || experiments.length === 0) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [testItems, defectMasters] = await Promise.all([
          getPersistentTestItems(),
          getPersistentDefectMasters()
        ]);
        const validMasters = defectMasters || [];
        setDbDefectMasters(validMasters);

        const sampleDefectCollector = new Set<string>();

        const blocks: ReportBlock[] = await Promise.all(
          experiments.map(async (exp) => {
            const samples = await getPersistentSamples(exp.id);
            const firstSample = samples[0];

            // 1. 蒐集此實驗樣品「實際存在」的缺陷種類
            const actualDefectSet = new Set<string>();

            samples.forEach(s => {
              s.defects?.forEach(d => {
                if (d.type && d.type.trim()) {
                  sampleDefectCollector.add(d.type.trim());
                  if (d.count > 0 || typeof d.count === 'number') {
                    actualDefectSet.add(d.type.trim());
                  }
                }
              });

              if (s.lensRows && s.lensRows.length > 0) {
                s.lensRows.forEach((lr: any) => {
                  if (lr.defects) {
                    Object.entries(lr.defects).forEach(([k, v]) => {
                      if (v && k.trim()) {
                        sampleDefectCollector.add(k.trim());
                        actualDefectSet.add(k.trim());
                      }
                    });
                  }
                  if (lr.grainGrade && lr.grainGrade !== 'A') {
                    sampleDefectCollector.add('紋路');
                    actualDefectSet.add('紋路');
                  }
                });
              }
            });

            // 初始缺陷欄位：以該實驗樣品實際擁有的缺陷為主；若無，帶入基礎資料主檔中的缺陷
            let defectColumns = Array.from(actualDefectSet);
            if (defectColumns.length === 0) {
              const masterNames = validMasters.map(d => d.name.trim()).filter(Boolean);
              if (masterNames.length > 0) {
                defectColumns = masterNames.slice(0, 8);
              } else {
                defectColumns = ['附加物', '氣泡', '毛邊', '雙邊', '痕痕', '破裂', '裂痕', '帶片'];
              }
            }

            // 2. 解析製程條件 (固化能量、設備)
            const curEnergy = firstSample?.curingEnergy || (() => {
              const exact = exp.processConditions?.find(c => c.name?.includes('固化能量') || (c.name?.includes('固化') && (c.name?.includes('能量') || c.type === 'Energy')));
              if (exact && exact.value !== undefined) return `${exact.value}${exact.unit ? ` ${exact.unit}` : ''}`.trim();
              const byEnergy = exp.processConditions?.find(c => c.name?.includes('能量') || c.type === 'Energy');
              if (byEnergy && byEnergy.value !== undefined) return `${byEnergy.value}${byEnergy.unit ? ` ${byEnergy.unit}` : ''}`.trim();
              return '';
            })();

            const curEquip = (() => {
              const cond = exp.processConditions?.find(c => c.name?.includes('設備') || c.name?.includes('機台') || c.name?.includes('固化機') || (c as any).equipment);
              return (cond as any)?.equipment || cond?.name || '';
            })();

            const rawDate = firstSample?.createdAt || exp.date || new Date().toISOString();
            const dateStr = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;

            // 3. 建立樣品列 (尺寸數據格式化為小數點後 2 位)
            const rows: ReportRow[] = samples.map((s, idx) => {
              const getDimensionMean = (aliases: string[], lensKey: keyof any): string | number => {
                if (s.lensRows && s.lensRows.length > 0) {
                  const vals = s.lensRows
                    .map((lr: any) => lr[lensKey])
                    .filter((v: any) => typeof v === 'number' && !isNaN(v));
                  if (vals.length > 0) {
                    const avg = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
                    return Number(avg.toFixed(2));
                  }
                }
                if (s.results && s.results.length > 0) {
                  const matchItem = testItems.find(ti => aliases.some(alias => ti.name.toLowerCase().includes(alias.toLowerCase())));
                  if (matchItem) {
                    const res = s.results.find(r => r.testItemId === matchItem.id);
                    if (res && res.mean !== undefined) {
                      const num = parseFloat(String(res.mean));
                      return isNaN(num) ? res.mean : Number(num.toFixed(2));
                    }
                  }
                }
                return '-';
              };

              const rowDefects: Record<string, number> = {};
              defectColumns.forEach(defName => {
                const match = s.defects?.find(d => d.type === defName);
                if (match && typeof match.count === 'number') {
                  rowDefects[defName] = match.count;
                  return;
                }
                if (s.lensRows && s.lensRows.length > 0) {
                  if (defName === '紋路') {
                    rowDefects[defName] = s.lensRows.filter((r: any) => r.defects?.['紋路'] || r.grainGrade === 'C').length;
                  } else {
                    rowDefects[defName] = s.lensRows.filter((r: any) => r.defects?.[defName]).length;
                  }
                  return;
                }
                rowDefects[defName] = 0;
              });

              const gradeA = s.gradeA ?? (s.lensRows ? s.lensRows.filter((r: any) => r.grainGrade === 'A').length : 0);
              const gradeB = s.gradeB ?? (s.lensRows ? s.lensRows.filter((r: any) => r.grainGrade === 'B').length : 0);
              const gradeC = s.gradeC ?? (s.lensRows ? s.lensRows.filter((r: any) => r.grainGrade === 'C').length : 0);

              return {
                id: s.id || `row_${idx}`,
                sampleCode: s.sampleCode || `樣品-${idx + 1}`,
                dia: getDimensionMean(['DIA', '直徑'], 'dia'),
                bc: getDimensionMean(['BC', '基弧'], 'bc'),
                ct: getDimensionMean(['CT', '厚度', '中心厚度'], 'ct'),
                et1: getDimensionMean(['ET-1', 'ET1', '邊厚1'], 'et1'),
                et2: getDimensionMean(['ET-2', 'ET2', '邊厚2'], 'et2'),
                et3: getDimensionMean(['ET-3', 'ET3', '邊厚3'], 'et3'),
                et4: getDimensionMean(['ET-4', 'ET4', '邊厚4'], 'et4'),
                power: getDimensionMean(['度數', 'FC', '屈光度', '焦距'], 'fc'),
                defects: rowDefects,
                gradeA,
                gradeB,
                gradeC,
              };
            });

            const defaultDefects: Record<string, number> = {};
            defectColumns.forEach(d => { defaultDefects[d] = 0; });

            const finalRows = rows.length > 0 ? rows : [
              {
                id: `new_${Date.now()}`,
                sampleCode: 'SMP-001',
                dia: '',
                bc: '',
                ct: '',
                et1: '',
                et2: '',
                et3: '',
                et4: '',
                power: '',
                defects: defaultDefects,
                gradeA: 0,
                gradeB: 0,
                gradeC: 0
              }
            ];

            return {
              experimentId: exp.id,
              experimentTitle: exp.title,
              batchNumber: firstSample?.batchNumber || exp.title || '',
              measureDate: dateStr,
              moldBatchNumber: firstSample?.moldBatchNumber || '',
              operator: exp.operator || '',
              formulationName: firstSample?.formulationName || exp.formulationName || (exp.formulation?.[0]?.materialName || ''),
              prepareTime: '',
              curingEquipment: curEquip,
              curingEnergy: curEnergy ? String(curEnergy) : '',
              defectColumns,
              rows: finalRows
            };
          })
        );

        setAllRecordedDefects(Array.from(sampleDefectCollector));
        setReportBlocks(blocks);
        if (blocks.length > 0) {
          const matchInitial = blocks.find(b => b.experimentId === initialExperimentId);
          setActiveExpId(matchInitial ? matchInitial.experimentId : blocks[0].experimentId);
          // 多筆實驗匯出時預設開啟全部垂直排版預覽，一次完整呈現所有實驗報表
          if (blocks.length > 1) {
            setPreviewAllStacked(true);
          }
        }
      } catch (err) {
        console.error('Failed to load export report data:', err);
        toast.error('載入實驗樣品數據失敗');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen, experiments, initialExperimentId]);

  const activeBlock = useMemo(() => {
    return reportBlocks.find(b => b.experimentId === activeExpId) || reportBlocks[0];
  }, [reportBlocks, activeExpId]);

  // 下拉選單候選清單：嚴格僅列出「基礎資料設定」中的「缺陷與等級定義」，沒出現在基礎資料設定中的缺陷不用列出來 (滿足用戶需求 1)
  const candidateDefectList = useMemo(() => {
    const list: CandidateDefect[] = [];
    const seenNames = new Set<string>();

    dbDefectMasters.forEach(d => {
      const name = d.name?.trim();
      if (name && !seenNames.has(name)) {
        seenNames.add(name);
        list.push({
          name,
          code: d.code,
          severity: d.severity,
          description: d.description,
          source: 'master'
        });
      }
    });

    return list;
  }, [dbDefectMasters]);

  // 修改表頭資訊
  const handleUpdateHeader = (expId: string, field: keyof Omit<ReportBlock, 'rows' | 'experimentId' | 'experimentTitle' | 'defectColumns'>, value: string) => {
    setReportBlocks(prev => prev.map(block => {
      if (block.experimentId === expId) {
        return { ...block, [field]: value };
      }
      return block;
    }));
  };

  // 修改儲存格內容
  const handleUpdateRowCell = (expId: string, rowId: string, colKey: keyof Omit<ReportRow, 'defects'>, value: any) => {
    setReportBlocks(prev => prev.map(block => {
      if (block.experimentId === expId) {
        return {
          ...block,
          rows: block.rows.map(row => {
            if (row.id === rowId) {
              return { ...row, [colKey]: value };
            }
            return row;
          })
        };
      }
      return block;
    }));
  };

  // 修改缺陷數量儲存格
  const handleUpdateDefectCount = (expId: string, rowId: string, defName: string, count: number) => {
    setReportBlocks(prev => prev.map(block => {
      if (block.experimentId === expId) {
        return {
          ...block,
          rows: block.rows.map(row => {
            if (row.id === rowId) {
              return {
                ...row,
                defects: {
                  ...row.defects,
                  [defName]: count
                }
              };
            }
            return row;
          })
        };
      }
      return block;
    }));
  };

  // 新增缺陷種類欄位
  const handleSelectDefectColumn = (expId: string, defName: string) => {
    const cleanName = defName.trim();
    if (!cleanName) return;

    setReportBlocks(prev => prev.map(block => {
      if (block.experimentId === expId) {
        if (block.defectColumns.includes(cleanName)) {
          toast.warning(`缺陷欄位「${cleanName}」已存在於表格中`);
          return block;
        }
        return {
          ...block,
          defectColumns: [...block.defectColumns, cleanName],
          rows: block.rows.map(r => ({
            ...r,
            defects: { ...r.defects, [cleanName]: 0 }
          }))
        };
      }
      return block;
    }));

    setDefectDropdownOpenFor(null);
    setDefectSearchText('');
    toast.success(`已新增缺陷種類欄位: ${cleanName}`);
  };

  // 移除缺陷種類欄位
  const handleRemoveDefectColumn = (expId: string, defName: string) => {
    setReportBlocks(prev => prev.map(block => {
      if (block.experimentId === expId) {
        if (block.defectColumns.length <= 1) {
          toast.warning('至少需保留一個缺陷欄位');
          return block;
        }
        return {
          ...block,
          defectColumns: block.defectColumns.filter(d => d !== defName)
        };
      }
      return block;
    }));
  };

  // 新增樣品列
  const handleAddRow = (expId: string) => {
    setReportBlocks(prev => prev.map(block => {
      if (block.experimentId === expId) {
        const nextIdx = block.rows.length + 1;
        const initialDefects: Record<string, number> = {};
        block.defectColumns.forEach(d => { initialDefects[d] = 0; });

        const newRow: ReportRow = {
          id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          sampleCode: `SMP-${nextIdx.toString().padStart(3, '0')}`,
          dia: '',
          bc: '',
          ct: '',
          et1: '',
          et2: '',
          et3: '',
          et4: '',
          power: '',
          defects: initialDefects,
          gradeA: 0,
          gradeB: 0,
          gradeC: 0
        };
        return { ...block, rows: [...block.rows, newRow] };
      }
      return block;
    }));
  };

  // 刪除樣品列
  const handleDeleteRow = (expId: string, rowId: string) => {
    setReportBlocks(prev => prev.map(block => {
      if (block.experimentId === expId) {
        if (block.rows.length <= 1) {
          toast.warning('至少需保留一筆樣品列');
          return block;
        }
        return {
          ...block,
          rows: block.rows.filter(r => r.id !== rowId)
        };
      }
      return block;
    }));
  };

  // 計算平均 / 合計列 (平均值顯示至小數點後第 2 位，滿足用戶需求 1)
  const calculateBlockSummary = (rows: ReportRow[], defectColumns: string[]) => {
    const calcAvg = (key: keyof Omit<ReportRow, 'defects'>) => {
      const nums = rows
        .map(r => typeof r[key] === 'number' ? r[key] as number : parseFloat(String(r[key])))
        .filter(n => !isNaN(n));
      if (nums.length === 0) return '-';
      return Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2));
    };

    const calcDefectSum = (defName: string) => {
      const nums = rows.map(r => r.defects?.[defName] || 0);
      return nums.reduce((a, b) => a + b, 0);
    };

    const calcSum = (key: 'gradeA' | 'gradeB' | 'gradeC') => {
      const nums = rows
        .map(r => typeof r[key] === 'number' ? r[key] as number : parseFloat(String(r[key])))
        .filter(n => !isNaN(n));
      return nums.reduce((a, b) => a + b, 0);
    };

    const defectSums: Record<string, number> = {};
    defectColumns.forEach(d => {
      defectSums[d] = calcDefectSum(d);
    });

    return {
      sampleCode: '平均 / 總計',
      dia: calcAvg('dia'),
      bc: calcAvg('bc'),
      ct: calcAvg('ct'),
      et1: calcAvg('et1'),
      et2: calcAvg('et2'),
      et3: calcAvg('et3'),
      et4: calcAvg('et4'),
      power: calcAvg('power'),
      defects: defectSums,
      gradeA: calcSum('gradeA'),
      gradeB: calcSum('gradeB'),
      gradeC: calcSum('gradeC'),
    };
  };

  // 動態分配表頭 8 個資訊格之寬度 (精確等分，保證總合 100% 等於 totalCols)
  const getHeaderSegments = (totalCols: number) => {
    const labelSpan = totalCols >= 16 ? 2 : 1;
    const totalLabelCols = labelSpan * 4;
    const remainingCols = totalCols - totalLabelCols;
    
    const baseV = Math.floor(remainingCols / 4);
    const extraV = remainingCols % 4;
    
    const colSpans = [
      labelSpan, baseV + (extraV > 0 ? 1 : 0),
      labelSpan, baseV + (extraV > 1 ? 1 : 0),
      labelSpan, baseV + (extraV > 2 ? 1 : 0),
      labelSpan, baseV,
    ];

    const segments: { start: number; end: number; span: number }[] = [];
    let curr = 0;
    for (const span of colSpans) {
      segments.push({ start: curr, end: curr + span - 1, span });
      curr += span;
    }
    return segments;
  };

  // 建立單一 Block 的 Excel 數據與合併儲存格設定
  const buildBlockAoaAndMerges = (block: ReportBlock, startRow: number) => {
    const data: any[][] = [];
    const merges: XLSX.Range[] = [];

    const N = block.defectColumns.length;
    const totalCols = 1 + 8 + N + 3;

    // 1. 標題列：數據彙整
    const titleRow = new Array(totalCols).fill('');
    titleRow[0] = '數據彙整';
    data.push(titleRow);
    merges.push({ s: { r: startRow, c: 0 }, e: { r: startRow, c: totalCols - 1 } });

    // 2. 表頭第一列 & 第二列
    const segments = getHeaderSegments(totalCols);

    const r1 = new Array(totalCols).fill('');
    r1[segments[0].start] = '生產批號';
    r1[segments[1].start] = block.batchNumber || '';
    r1[segments[2].start] = '量測日期:';
    r1[segments[3].start] = block.measureDate || '';
    r1[segments[4].start] = '模具批號';
    r1[segments[5].start] = block.moldBatchNumber || '';
    r1[segments[6].start] = '檢測人員:';
    r1[segments[7].start] = block.operator || '';
    data.push(r1);

    const r1Idx = startRow + 1;
    segments.forEach(seg => {
      merges.push({ s: { r: r1Idx, c: seg.start }, e: { r: r1Idx, c: seg.end } });
    });

    const r2 = new Array(totalCols).fill('');
    r2[segments[0].start] = '材料名稱/批次';
    r2[segments[1].start] = block.formulationName || '';
    r2[segments[2].start] = '配置時間';
    r2[segments[3].start] = block.prepareTime || '';
    r2[segments[4].start] = '固化設備';
    r2[segments[5].start] = block.curingEquipment || '';
    r2[segments[6].start] = '固化能量';
    r2[segments[7].start] = block.curingEnergy || '';
    data.push(r2);

    const r2Idx = startRow + 2;
    segments.forEach(seg => {
      merges.push({ s: { r: r2Idx, c: seg.start }, e: { r: r2Idx, c: seg.end } });
    });

    // 3. 表格大分類表頭 (Row 3):
    const r3 = new Array(totalCols).fill('');
    r3[1] = '鏡片特性';
    r3[9] = '鏡片缺陷';
    r3[9 + N] = '依出貨標準分級';
    data.push(r3);

    const r3Idx = startRow + 3;
    merges.push({ s: { r: r3Idx, c: 1 }, e: { r: r3Idx, c: 8 } });
    merges.push({ s: { r: r3Idx, c: 9 }, e: { r: r3Idx, c: 8 + N } });
    merges.push({ s: { r: r3Idx, c: 9 + N }, e: { r: r3Idx, c: 8 + N + 3 } });

    // 4. 表格細項表頭 (Row 4):
    const r4 = [
      '樣品',
      'DIA\n(mm)',
      'BC\n(mm)',
      'CT\n(um)',
      'ET-1\n(um)',
      'ET-2\n(um)',
      'ET-3\n(um)',
      'ET-4\n(um)',
      '度數\n(D)',
      ...block.defectColumns,
      'A級\n合格片',
      'B級\n合格片',
      'C級\n不良片',
    ];
    data.push(r4);

    // 5. 資料列
    const formatVal = (v: any) => {
      if (v === '' || v === undefined || v === null || v === '-') return '-';
      const num = parseFloat(String(v));
      return isNaN(num) ? String(v) : Number(num.toFixed(2));
    };

    block.rows.forEach(r => {
      const defectVals = block.defectColumns.map(dName => formatVal(r.defects?.[dName] ?? 0));
      data.push([
        r.sampleCode,
        formatVal(r.dia),
        formatVal(r.bc),
        formatVal(r.ct),
        formatVal(r.et1),
        formatVal(r.et2),
        formatVal(r.et3),
        formatVal(r.et4),
        formatVal(r.power),
        ...defectVals,
        formatVal(r.gradeA),
        formatVal(r.gradeB),
        formatVal(r.gradeC),
      ]);
    });

    // 6. 平均 / 總計列
    if (includeSummaryRow) {
      const sum = calculateBlockSummary(block.rows, block.defectColumns);
      const sumDefects = block.defectColumns.map(dName => sum.defects[dName] ?? 0);
      data.push([
        sum.sampleCode,
        sum.dia,
        sum.bc,
        sum.ct,
        sum.et1,
        sum.et2,
        sum.et3,
        sum.et4,
        sum.power,
        ...sumDefects,
        sum.gradeA,
        sum.gradeB,
        sum.gradeC,
      ]);
    }

    return { data, merges, rowCount: data.length, totalCols };
  };

  // 觸發 Excel 匯出：多筆實驗時彈出視窗讓使用者選擇匯出模式 (滿足用戶需求 2)
  const handleExportExcel = () => {
    if (reportBlocks.length === 0) {
      toast.warning('無可匯出的數據');
      return;
    }
    if (reportBlocks.length === 1) {
      executeExcelExport('single-sheet');
      return;
    }
    setIsExportModeModalOpen(true);
  };

  // 執行 Excel 匯出 (依使用者選取之模式：獨立工作表 或 單一工作表連續排版)
  const executeExcelExport = (mode: 'multi-sheet' | 'single-sheet') => {
    setIsExportModeModalOpen(false);
    setExportMode(mode);

    try {
      const wb = XLSX.utils.book_new();

      if (mode === 'multi-sheet') {
        const usedSheetNames = new Set<string>();
        reportBlocks.forEach((block, idx) => {
          const { data, merges } = buildBlockAoaAndMerges(block, 0);
          const ws = XLSX.utils.aoa_to_sheet(data);
          ws['!merges'] = merges;

          const colWidths = [
            { wch: 14 },
            { wch: 9 }, { wch: 9 }, { wch: 9 },
            { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 },
            { wch: 9 },
            ...block.defectColumns.map(() => ({ wch: 8 })),
            { wch: 11 }, { wch: 11 }, { wch: 11 },
          ];
          ws['!cols'] = colWidths;

          let cleanTitle = (block.experimentTitle || block.batchNumber || `實驗_${idx + 1}`)
            .replace(/[:\\/?*\[\]]/g, '_')
            .trim()
            .substring(0, 28);
          if (!cleanTitle) cleanTitle = `Sheet_${idx + 1}`;
          let uniqueName = cleanTitle;
          let counter = 1;
          while (usedSheetNames.has(uniqueName)) {
            uniqueName = `${cleanTitle}_${counter}`;
            counter++;
          }
          usedSheetNames.add(uniqueName);

          XLSX.utils.book_append_sheet(wb, ws, uniqueName);
        });
      } else {
        const allData: any[][] = [];
        const allMerges: XLSX.Range[] = [];
        let currentRow = 0;
        let maxDefects = 0;

        reportBlocks.forEach((block, idx) => {
          if (idx > 0) {
            allData.push([]);
            allData.push([]);
            currentRow += 2;
          }
          if (block.defectColumns.length > maxDefects) {
            maxDefects = block.defectColumns.length;
          }
          const { data, merges, rowCount } = buildBlockAoaAndMerges(block, currentRow);
          allData.push(...data);
          allMerges.push(...merges);
          currentRow += rowCount;
        });

        const ws = XLSX.utils.aoa_to_sheet(allData);
        ws['!merges'] = allMerges;
        ws['!cols'] = [
          { wch: 14 },
          { wch: 9 }, { wch: 9 }, { wch: 9 },
          { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 },
          { wch: 9 },
          ...Array(maxDefects).fill({ wch: 8 }),
          { wch: 11 }, { wch: 11 }, { wch: 11 }
        ];
        XLSX.utils.book_append_sheet(wb, ws, '數據彙整總表');
      }

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = reportBlocks.length === 1
        ? `數據彙整_${reportBlocks[0].batchNumber || reportBlocks[0].experimentTitle}_${dateStr}.xlsx`
        : `數據彙整_共${reportBlocks.length}筆實驗_${dateStr}.xlsx`;

      XLSX.writeFile(wb, filename);
      toast.success(`Excel 報表匯出成功 (${reportBlocks.length} 筆實驗，模式：${mode === 'multi-sheet' ? '獨立工作表' : '連續排版'})`);
    } catch (err) {
      console.error('Failed to export Excel:', err);
      toast.error('匯出 Excel 報表失敗，請重試');
    }
  };

  // 生成純淨 HTML (隔離外部 Tailwind v4 樣式，供 PDF 與列印使用)
  const generatePureReportHtml = (block: ReportBlock, includeSummary: boolean): string => {
    const N = block.defectColumns.length;
    const totalCols = 1 + 8 + N + 3;
    const segments = getHeaderSegments(totalCols);
    const sum = includeSummary ? calculateBlockSummary(block.rows, block.defectColumns) : null;

    return `
      <div style="font-family: Arial, 'Microsoft JhengHei', '微軟正黑體', sans-serif; font-size: 11px; color: #000000; background: #ffffff; width: 100%; max-width: 1180px; margin: 0 auto; box-sizing: border-box;">
        <table style="width: 100%; border-collapse: collapse; border: 2px solid #000000; text-align: center; font-size: 11px; table-layout: auto;">
          <tbody>
            <!-- 大標題數據彙整：粗外框線 (2px 全面粗框線，滿足用戶需求 1) -->
            <tr>
              <td colspan="${totalCols}" style="border: 2px solid #000000 !important; padding: 5px 0; font-size: 16px; font-weight: bold; letter-spacing: 6px; font-family: 'Microsoft JhengHei', '微軟正黑體', Arial, sans-serif; background: #ffffff; text-align: center; vertical-align: middle; line-height: 1.2;">
                數 據 彙 整
              </td>
            </tr>

            <!-- 表頭第一列 (垂直及水平置中，滿足用戶需求 2) -->
            <tr>
              <td colspan="${segments[0].span}" style="border: 1px solid #000000; font-weight: bold; background: #f8fafc; padding: 3px 4px; text-align: center; vertical-align: middle; line-height: 1.2;">生產批號</td>
              <td colspan="${segments[1].span}" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 3px 6px; font-weight: bold; line-height: 1.2;">${block.batchNumber || ''}</td>
              <td colspan="${segments[2].span}" style="border: 1px solid #000000; font-weight: bold; background: #f8fafc; padding: 3px 4px; text-align: center; vertical-align: middle; line-height: 1.2;">量測日期:</td>
              <td colspan="${segments[3].span}" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 3px 6px; line-height: 1.2;">${block.measureDate || ''}</td>
              <td colspan="${segments[4].span}" style="border: 1px solid #000000; font-weight: bold; background: #f8fafc; padding: 3px 4px; text-align: center; vertical-align: middle; line-height: 1.2;">模具批號</td>
              <td colspan="${segments[5].span}" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 3px 6px; line-height: 1.2;">${block.moldBatchNumber || ''}</td>
              <td colspan="${segments[6].span}" style="border: 1px solid #000000; font-weight: bold; background: #f8fafc; padding: 3px 4px; text-align: center; vertical-align: middle; line-height: 1.2;">檢測人員:</td>
              <td colspan="${segments[7].span}" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 3px 6px; line-height: 1.2;">${block.operator || ''}</td>
            </tr>

            <!-- 表頭第二列 (垂直及水平置中，滿足用戶需求 2) -->
            <tr>
              <td colspan="${segments[0].span}" style="border: 1px solid #000000; font-weight: bold; background: #f8fafc; padding: 3px 4px; text-align: center; vertical-align: middle; line-height: 1.2;">材料名稱/批次</td>
              <td colspan="${segments[1].span}" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 3px 6px; line-height: 1.2;">${block.formulationName || ''}</td>
              <td colspan="${segments[2].span}" style="border: 1px solid #000000; font-weight: bold; background: #f8fafc; padding: 3px 4px; text-align: center; vertical-align: middle; line-height: 1.2;">配置時間</td>
              <td colspan="${segments[3].span}" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 3px 6px; line-height: 1.2;">${block.prepareTime || ''}</td>
              <td colspan="${segments[4].span}" style="border: 1px solid #000000; font-weight: bold; background: #f8fafc; padding: 3px 4px; text-align: center; vertical-align: middle; line-height: 1.2;">固化設備</td>
              <td colspan="${segments[5].span}" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 3px 6px; line-height: 1.2;">${block.curingEquipment || ''}</td>
              <td colspan="${segments[6].span}" style="border: 1px solid #000000; font-weight: bold; background: #f8fafc; padding: 3px 4px; text-align: center; vertical-align: middle; line-height: 1.2;">固化能量</td>
              <td colspan="${segments[7].span}" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 3px 6px; line-height: 1.2;">${block.curingEnergy || ''}</td>
            </tr>

            <!-- 大分類標題 (Row 3: 粗框線分隔) -->
            <tr style="border-top: 2px solid #000000;">
              <th style="border: 1px solid #000000; background: #ffffff; text-align: center; vertical-align: middle; padding: 3px 2px; line-height: 1.2;"></th>
              <th colspan="8" style="border: 1px solid #000000; font-weight: bold; background: #ffffff; font-size: 11px; text-align: center; vertical-align: middle; padding: 3px 2px; line-height: 1.2;">鏡 片 特 性</th>
              <th colspan="${N}" style="border: 1px solid #000000; font-weight: bold; background: #ffffff; font-size: 11px; text-align: center; vertical-align: middle; padding: 3px 2px; line-height: 1.2;">鏡 片 缺 陷</th>
              <th colspan="3" style="border: 1px solid #000000; font-weight: bold; background: #d8b4fe; color: #3b0764; font-size: 11px; text-align: center; vertical-align: middle; padding: 3px 2px; line-height: 1.2;">依出貨標準分級</th>
            </tr>

            <!-- 欄位細稱 (Row 4: DIA跟BC顯示單位 mm，垂直與水平置中) -->
            <tr style="background: #ffffff; font-weight: bold;">
              <th style="border: 1px solid #000000; padding: 2px 2px; text-align: center; vertical-align: middle; line-height: 1.15;">樣品</th>
              <th style="border: 1px solid #000000; padding: 2px 2px; text-align: center; vertical-align: middle; line-height: 1.15;">DIA<br><span style="font-size: 9px; font-weight: normal;">(mm)</span></th>
              <th style="border: 1px solid #000000; padding: 2px 2px; text-align: center; vertical-align: middle; line-height: 1.15;">BC<br><span style="font-size: 9px; font-weight: normal;">(mm)</span></th>
              <th style="border: 1px solid #000000; padding: 2px 2px; text-align: center; vertical-align: middle; line-height: 1.15;">CT<br><span style="font-size: 9px; font-weight: normal;">(um)</span></th>
              <th style="border: 1px solid #000000; padding: 2px 2px; text-align: center; vertical-align: middle; line-height: 1.15;">ET-1<br><span style="font-size: 9px; font-weight: normal;">(um)</span></th>
              <th style="border: 1px solid #000000; padding: 2px 2px; text-align: center; vertical-align: middle; line-height: 1.15;">ET-2<br><span style="font-size: 9px; font-weight: normal;">(um)</span></th>
              <th style="border: 1px solid #000000; padding: 2px 2px; text-align: center; vertical-align: middle; line-height: 1.15;">ET-3<br><span style="font-size: 9px; font-weight: normal;">(um)</span></th>
              <th style="border: 1px solid #000000; padding: 2px 2px; text-align: center; vertical-align: middle; line-height: 1.15;">ET-4<br><span style="font-size: 9px; font-weight: normal;">(um)</span></th>
              <th style="border: 1px solid #000000; padding: 2px 2px; text-align: center; vertical-align: middle; line-height: 1.15;">度數<br><span style="font-size: 9px; font-weight: normal;">(D)</span></th>
              ${block.defectColumns.map(d => `<th style="border: 1px solid #000000; padding: 2px 2px; text-align: center; vertical-align: middle; line-height: 1.15;">${d}</th>`).join('')}
              <th style="border: 1px solid #000000; padding: 2px 2px; background: #ede9fe; color: #3b0764; text-align: center; vertical-align: middle; line-height: 1.15;">A級<br>合格片</th>
              <th style="border: 1px solid #000000; padding: 2px 2px; background: #ede9fe; color: #3b0764; text-align: center; vertical-align: middle; line-height: 1.15;">B級<br>合格片</th>
              <th style="border: 1px solid #000000; padding: 2px 2px; background: #ede9fe; color: #3b0764; text-align: center; vertical-align: middle; line-height: 1.15;">C級<br>不良片</th>
            </tr>

            <!-- 資料列 (垂直及水平置中，滿足用戶需求 2) -->
            ${block.rows.map((r, idx) => {
              const rowBg = idx % 2 === 1 ? '#f8fafc' : '#ffffff';
              const purpleBg = idx % 2 === 1 ? '#e9d5ff' : '#ede9fe';
              return `
                <tr style="background: ${rowBg};">
                  <td style="border: 1px solid #000000; font-weight: bold; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${r.sampleCode || ''}</td>
                  <td style="border: 1px solid #000000; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${r.dia ?? '-'}</td>
                  <td style="border: 1px solid #000000; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${r.bc ?? '-'}</td>
                  <td style="border: 1px solid #000000; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${r.ct ?? '-'}</td>
                  <td style="border: 1px solid #000000; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${r.et1 ?? '-'}</td>
                  <td style="border: 1px solid #000000; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${r.et2 ?? '-'}</td>
                  <td style="border: 1px solid #000000; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${r.et3 ?? '-'}</td>
                  <td style="border: 1px solid #000000; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${r.et4 ?? '-'}</td>
                  <td style="border: 1px solid #000000; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${r.power ?? '-'}</td>
                  ${block.defectColumns.map(d => `<td style="border: 1px solid #000000; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${r.defects[d] ?? 0}</td>`).join('')}
                  <td style="border: 1px solid #000000; font-weight: bold; background: ${purpleBg}; color: #15803d; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${r.gradeA ?? 0}</td>
                  <td style="border: 1px solid #000000; font-weight: bold; background: ${purpleBg}; color: #1d4ed8; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${r.gradeB ?? 0}</td>
                  <td style="border: 1px solid #000000; font-weight: bold; background: ${purpleBg}; color: #b91c1c; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${r.gradeC ?? 0}</td>
                </tr>
              `;
            }).join('')}

            <!-- 合計列 (垂直及水平置中，滿足用戶需求 2) -->
            ${sum ? `
              <tr style="background: #fef3c7; font-weight: bold; border-top: 2px solid #000000; border-bottom: 2px solid #000000;">
                <td style="border: 1px solid #000000; color: #78350f; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${sum.sampleCode}</td>
                <td style="border: 1px solid #000000; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${sum.dia}</td>
                <td style="border: 1px solid #000000; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${sum.bc}</td>
                <td style="border: 1px solid #000000; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${sum.ct}</td>
                <td style="border: 1px solid #000000; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${sum.et1}</td>
                <td style="border: 1px solid #000000; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${sum.et2}</td>
                <td style="border: 1px solid #000000; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${sum.et3}</td>
                <td style="border: 1px solid #000000; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${sum.et4}</td>
                <td style="border: 1px solid #000000; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${sum.power}</td>
                ${block.defectColumns.map(d => `<td style="border: 1px solid #000000; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${sum.defects[d] ?? 0}</td>`).join('')}
                <td style="border: 1px solid #000000; background: #ddd6fe; color: #15803d; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${sum.gradeA}</td>
                <td style="border: 1px solid #000000; background: #ddd6fe; color: #1d4ed8; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${sum.gradeB}</td>
                <td style="border: 1px solid #000000; background: #ddd6fe; color: #b91c1c; padding: 3px 2px; text-align: center; vertical-align: middle; line-height: 1.2;">${sum.gradeC}</td>
              </tr>
            ` : ''}
          </tbody>
        </table>
      </div>
    `;
  };

  // 匯出 PDF：透過純淨獨立的隱藏 IFrame 隔離 Tailwind v4 OKLCH，徹底杜絕 html2canvas 解析失敗 (解決用戶需求 4)
  const handleExportPDF = async () => {
    if (reportBlocks.length === 0) {
      toast.warning('無可匯出的數據');
      return;
    }

    setIsExportingPDF(true);
    const toastId = toast.loading('正在產生 A4 橫向最佳適配 PDF 報表...');

    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // 匯出全部勾選/載入之實驗區塊 (每筆實驗獨立一頁 A4 橫向)
      const blocksToExport = reportBlocks;

      for (let i = 0; i < blocksToExport.length; i++) {
        const block = blocksToExport[i];

        // 建立獨立 iframe 隔離主文檔的 Tailwind v4 oklch 樣式
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.left = '0';
        iframe.style.top = '0';
        iframe.style.width = '1200px';
        iframe.style.height = '850px';
        iframe.style.opacity = '0.01';
        iframe.style.pointerEvents = 'none';
        iframe.style.zIndex = '-99999';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (!doc) throw new Error('無法初始化 PDF 渲染畫布');

        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8" />
              <style>
                * { box-sizing: border-box; }
                body {
                  margin: 0;
                  padding: 12px;
                  background: #ffffff;
                  font-family: Arial, "Microsoft JhengHei", "微軟正黑體", sans-serif;
                  -webkit-font-smoothing: antialiased;
                }
                table {
                  border-collapse: collapse !important;
                  border: 2px solid #000000 !important;
                  width: 100%;
                }
                table td, table th {
                  text-align: center !important;
                  vertical-align: middle !important;
                  border: 1px solid #000000;
                  line-height: 1.2 !important;
                }
              </style>
            </head>
            <body>
              ${generatePureReportHtml(block, includeSummaryRow)}
            </body>
          </html>
        `);
        doc.close();

        // 等待字體與排版引擎就緒
        await new Promise(r => setTimeout(r, 200));

        const targetEl = doc.body.firstElementChild as HTMLElement;

        // 徹底修復 html2canvas 在 Chromium/Windows 下文字 baseline 下沉偏移 (徹底解決 PDF 偏下貼框問題)
        const win = iframe.contentWindow;
        const targetCtxClasses: (typeof CanvasRenderingContext2D)[] = [CanvasRenderingContext2D];
        if (win && (win as any).CanvasRenderingContext2D && (win as any).CanvasRenderingContext2D !== CanvasRenderingContext2D) {
          targetCtxClasses.push((win as any).CanvasRenderingContext2D);
        }

        const origFillTexts = targetCtxClasses.map(c => c.prototype.fillText);
        const origStrokeTexts = targetCtxClasses.map(c => c.prototype.strokeText);

        targetCtxClasses.forEach((c, idx) => {
          const origFill = origFillTexts[idx];
          const origStroke = origStrokeTexts[idx];

          c.prototype.fillText = function (text: string, x: number, y: number, maxWidth?: number) {
            // y 向上微調校正 2.6 CSS 像素 (抵消 html2canvas +2px 與 fontMetrics 偏差，實現絕對垂直置中)
            const adjustedY = y - 2.6;
            return typeof maxWidth === 'number'
              ? origFill.call(this, text, x, adjustedY, maxWidth)
              : origFill.call(this, text, x, adjustedY);
          };

          c.prototype.strokeText = function (text: string, x: number, y: number, maxWidth?: number) {
            const adjustedY = y - 2.6;
            return typeof maxWidth === 'number'
              ? origStroke.call(this, text, x, adjustedY, maxWidth)
              : origStroke.call(this, text, x, adjustedY);
          };
        });

        let canvas: HTMLCanvasElement;
        try {
          canvas = await html2canvas(targetEl, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
          });
        } finally {
          targetCtxClasses.forEach((c, idx) => {
            c.prototype.fillText = origFillTexts[idx];
            c.prototype.strokeText = origStrokeTexts[idx];
          });
        }

        document.body.removeChild(iframe);

        if (i > 0) {
          pdf.addPage('a4', 'landscape');
        }

        const imgData = canvas.toDataURL('image/png');

        const pageWidth = 297;
        const pageHeight = 210;
        const marginX = 8;
        const marginY = 8;

        const availWidth = pageWidth - marginX * 2; // 281mm
        const availHeight = pageHeight - marginY * 2; // 194mm

        let renderWidth = availWidth;
        let renderHeight = (canvas.height * renderWidth) / canvas.width;

        if (renderHeight > availHeight) {
          const ratio = availHeight / renderHeight;
          renderWidth = renderWidth * ratio;
          renderHeight = availHeight;
        }

        const xOffset = marginX + (availWidth - renderWidth) / 2;
        const yOffset = marginY + (availHeight - renderHeight) / 2;

        pdf.addImage(imgData, 'PNG', xOffset, yOffset, renderWidth, renderHeight, undefined, 'FAST');
      }

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = blocksToExport.length === 1
        ? `數據彙整_${blocksToExport[0].batchNumber || blocksToExport[0].experimentTitle}_${dateStr}.pdf`
        : `數據彙整_共${blocksToExport.length}筆實驗_${dateStr}.pdf`;

      pdf.save(filename);
      toast.success('PDF 報表匯出成功 (已自動適配 A4 橫向完整呈現)', { id: toastId });
    } catch (err: any) {
      console.error('Failed to export PDF:', err);
      toast.error(`匯出 PDF 失敗: ${err?.message || '請使用「列印」功能另存為 PDF'}`, { id: toastId });
    } finally {
      setIsExportingPDF(false);
    }
  };

  // 列印：採用具備有效視窗尺寸之隱藏 IFrame，確保 Chromium 預覽畫面完整不留白
  const handlePrint = () => {
    // 列印全部勾選/載入之實驗區塊
    const blocksToPrint = reportBlocks;
    if (blocksToPrint.length === 0) return;

    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.left = '0';
      iframe.style.top = '0';
      iframe.style.width = '1200px';
      iframe.style.height = '900px';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.style.zIndex = '-99999';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        return;
      }

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>數據彙整報表</title>
            <style>
              @page { size: A4 landscape; margin: 8mm 6mm; }
              * { box-sizing: border-box; }
              body {
                margin: 0;
                padding: 0;
                background: #ffffff;
                font-family: Arial, "Microsoft JhengHei", "微軟正黑體", sans-serif;
                -webkit-font-smoothing: antialiased;
              }
              table {
                border-collapse: collapse !important;
                border: 2px solid #000000 !important;
                width: 100%;
              }
              table td, table th {
                text-align: center !important;
                vertical-align: middle !important;
                border: 1px solid #000000;
                line-height: 1.2 !important;
              }
              .page-break { page-break-after: always; break-after: page; }
              .report-wrap { margin-bottom: 20px; }
            </style>
          </head>
          <body>
            ${blocksToPrint.map((b, idx) => `
              <div class="report-wrap ${idx < blocksToPrint.length - 1 ? 'page-break' : ''}">
                ${generatePureReportHtml(b, includeSummaryRow)}
              </div>
            `).join('')}
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (err) {
          console.error('Iframe print error:', err);
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 2000);
        }
      }, 450);
    } catch (e) {
      console.error('Print iframe init error:', e);
      window.print();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={cn(
      "fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-hidden print:p-0 print:bg-white",
      isFullScreen && "p-0"
    )}>
      {/* Modal Main Frame */}
      <div className={cn(
        "relative w-full bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-all print:h-auto print:shadow-none print:border-none print:rounded-none",
        isFullScreen 
          ? "w-screen h-screen rounded-none" 
          : "max-w-[98vw] 2xl:max-w-[1680px] h-[94vh] rounded-2xl"
      )}>
        
        {/* Top Header & Action Bar */}
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/90 flex flex-wrap items-center justify-between gap-3 print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-brand-100">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                數據彙整報表預覽與匯出
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-brand-100 text-brand-700">
                  {reportBlocks.length} 筆實驗
                </span>
              </h2>
              <p className="text-[11px] text-slate-500">
                依樣品彙整尺寸平均值(預設小數點後2位)與實際缺陷件數；支援資料庫缺陷主檔選單、A4 橫向 PDF 匯出。
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 統計合計列 Checkbox */}
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 cursor-pointer shadow-2xs">
              <input 
                type="checkbox"
                checked={includeSummaryRow}
                onChange={(e) => setIncludeSummaryRow(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              含統計合計列
            </label>

            {/* 全螢幕切換按鈕 */}
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-all shadow-2xs cursor-pointer"
              title={isFullScreen ? "退出全螢幕" : "全螢幕預覽"}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* A4 橫向 PDF 匯出按鈕 */}
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
              title="匯出自動適配 A4 橫向之高解析度 PDF 檔案"
            >
              {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin text-rose-600" /> : <FileDown className="w-4 h-4 text-rose-600" />}
              匯出 PDF (A4 橫向{reportBlocks.length > 1 ? ` · 共 ${reportBlocks.length} 頁` : ''})
            </button>

            {/* 列印按鈕 */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              列印{reportBlocks.length > 1 ? ` (${reportBlocks.length} 筆)` : ''}
            </button>

            {/* Excel 匯出按鈕 */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-bold hover:brightness-105 transition-all shadow-md shadow-emerald-100 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              匯出 Excel ({reportBlocks.length} 筆實驗)
            </button>

            {/* 關閉按鈕 */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Experiment Navigation Tabs (多筆實驗時顯示) */}
        {reportBlocks.length > 1 && (
          <div className="px-5 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between gap-3 overflow-x-auto print:hidden shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                切換預覽實驗:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                {reportBlocks.map((b, idx) => {
                  const isActive = b.experimentId === activeExpId && !previewAllStacked;
                  return (
                    <button
                      key={b.experimentId}
                      type="button"
                      onClick={() => {
                        setActiveExpId(b.experimentId);
                        setPreviewAllStacked(false);
                      }}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer",
                        isActive
                          ? "bg-brand-600 text-white shadow-sm"
                          : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                      )}
                    >
                      {idx + 1}. {b.experimentTitle || `實驗 ${idx + 1}`}
                      <span className="ml-1.5 opacity-80 text-[10px]">({b.rows.length} 樣品)</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPreviewAllStacked(!previewAllStacked)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-all border cursor-pointer",
                previewAllStacked
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              {previewAllStacked ? '切換為分頁檢視' : '垂直連續預覽全部'}
            </button>
          </div>
        )}

        {/* Main Content Area (表格展示區) */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-100/60 pb-28 print:p-0 print:bg-white print:overflow-visible print:pb-0">
          {isLoading ? (
            <div className="py-24 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto"></div>
              <p className="text-sm font-medium text-slate-500">正在整理樣品統計數據與報表格式...</p>
            </div>
          ) : reportBlocks.length === 0 ? (
            <div className="py-24 text-center text-slate-400">
              <Info className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>查無樣品資料</p>
            </div>
          ) : (
            (previewAllStacked ? reportBlocks : [activeBlock]).map((block, bIdx) => {
              const N = block.defectColumns.length;
              const totalCols = 1 + 8 + N + 3;
              const segments = getHeaderSegments(totalCols);

              return (
                <div 
                  key={block.experimentId}
                  className="mb-8 last:mb-0 space-y-3 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm print:p-0 print:border-none print:shadow-none print:mb-8"
                >
                  {/* 實驗名稱標題與操作按鈕 */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 print:hidden">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-100 text-slate-700">
                        #{bIdx + 1}
                      </span>
                      <h3 className="text-sm font-bold text-slate-800">
                        {block.experimentTitle}
                      </h3>
                      <span className="text-xs text-slate-400">
                        (共 {block.rows.length} 筆樣品，包含 {block.defectColumns.length} 種缺陷欄位)
                      </span>
                    </div>

                    <div className="flex items-center gap-2 relative">
                      {/* 下拉選單：列出基礎資料設定中的缺陷與等級定義及樣品歷史缺陷 (滿足用戶需求 2) */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setDefectDropdownOpenFor(defectDropdownOpenFor === block.experimentId ? null : block.experimentId)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                          title="從基礎資料設定與資料庫選取缺陷欄位"
                        >
                          <Database className="w-3.5 h-3.5" />
                          新增缺陷欄位
                          <ChevronDown className="w-3 h-3 text-indigo-500" />
                        </button>

                        {defectDropdownOpenFor === block.experimentId && (
                          <div 
                            ref={defectDropdownRef}
                            className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2.5 space-y-2 text-xs"
                          >
                            <div className="font-bold text-slate-700 pb-1 border-b border-slate-100 flex items-center justify-between">
                              <span>選取缺陷種類</span>
                              <span className="text-[10px] text-slate-400">基礎資料設定</span>
                            </div>

                            {/* 搜尋過濾 */}
                            <input
                              type="text"
                              value={defectSearchText}
                              onChange={(e) => setDefectSearchText(e.target.value)}
                              placeholder="搜尋基礎資料設定之缺陷名稱或代碼..."
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 outline-none focus:border-brand-500 text-xs"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const available = candidateDefectList
                                    .filter(d => !block.defectColumns.includes(d.name))
                                    .filter(d => !defectSearchText.trim() || d.name.toLowerCase().includes(defectSearchText.trim().toLowerCase()) || (d.code && d.code.toLowerCase().includes(defectSearchText.trim().toLowerCase())));
                                  if (available.length > 0) {
                                    handleSelectDefectColumn(block.experimentId, available[0].name);
                                  }
                                }
                              }}
                            />

                            {/* 列出基礎資料設定中的缺陷與等級定義 (嚴格僅列出基礎資料設定項目，沒出現的不用列出來) */}
                            <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
                              {(() => {
                                const available = candidateDefectList
                                  .filter(d => !block.defectColumns.includes(d.name))
                                  .filter(d => !defectSearchText.trim() || d.name.toLowerCase().includes(defectSearchText.trim().toLowerCase()) || (d.code && d.code.toLowerCase().includes(defectSearchText.trim().toLowerCase())));

                                if (available.length === 0) {
                                  return (
                                    <div className="py-4 text-center text-xs text-slate-400">
                                      {candidateDefectList.length === 0 ? '「基礎資料設定」中尚無缺陷定義' : '無相符的基礎資料缺陷項目'}
                                    </div>
                                  );
                                }

                                return available.map(item => (
                                  <button
                                    key={item.name}
                                    type="button"
                                    onClick={() => handleSelectDefectColumn(block.experimentId, item.name)}
                                    className="w-full text-left px-2 py-1.5 hover:bg-brand-50 text-slate-700 hover:text-brand-700 rounded flex items-center justify-between cursor-pointer transition-colors"
                                  >
                                    <div className="flex items-center gap-1.5">
                                      {item.code && (
                                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1 py-0.2 rounded">
                                          {item.code}
                                        </span>
                                      )}
                                      <span className="font-bold">{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {item.severity && (
                                        <span className={cn(
                                          "text-[10px] px-1.5 py-0.2 rounded font-bold",
                                          item.severity === 'Critical' ? "bg-rose-100 text-rose-700" :
                                          item.severity === 'Major' ? "bg-amber-100 text-amber-700" :
                                          "bg-blue-100 text-blue-700"
                                        )}>
                                          {item.severity}
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                ));
                              })()}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 新增樣品列 */}
                      <button
                        type="button"
                        onClick={() => handleAddRow(block.experimentId)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold rounded-lg border border-brand-200 transition-all cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        新增樣品列
                      </button>
                    </div>
                  </div>

                  {/* 報表表格：w-full 填滿預覽窗格，右側不再出現空白斷層 (徹底解決用戶需求 3) */}
                  <div className="overflow-x-auto w-full">
                    <table className="w-full min-w-[1020px] border-collapse text-center text-xs border-2 border-slate-900 bg-white">
                      <tbody>
                        {/* 大標題：數 據 彙 整 (粗框線) */}
                        <tr className="border-b-2 border-slate-900">
                          <td 
                            colSpan={totalCols} 
                            className="py-2.5 text-center text-base sm:text-lg font-bold tracking-widest font-serif bg-white text-slate-900 border-b-2 border-slate-900"
                          >
                            數 據 彙 整
                          </td>
                        </tr>

                        {/* 表頭第 1 列 */}
                        <tr className="border-b border-slate-900 h-8">
                          <td 
                            colSpan={segments[0].span} 
                            className="font-bold border-r border-slate-900 bg-slate-50 text-slate-800 px-1 relative group cursor-help"
                            title="批號定義：日期+第幾組實驗定義 EX:20261013-1"
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span>生產批號</span>
                              <Info className="w-3 h-3 text-slate-400 print:hidden" />
                            </div>
                            {/* 浮動提示泡泡 (滿足用戶需求 3) */}
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-[11px] font-medium rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none animate-in fade-in duration-150 border border-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                              <span>[批號定義：日期+第幾組實驗定義 EX:20261013-1]</span>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                            </div>
                          </td>
                          <td 
                            colSpan={segments[1].span} 
                            className="border-r border-slate-900 px-1 text-left relative group"
                          >
                            <input 
                              type="text"
                              value={block.batchNumber}
                              onChange={(e) => handleUpdateHeader(block.experimentId, 'batchNumber', e.target.value)}
                              placeholder="生產批號 (EX: 20261013-1)"
                              title="[批號定義：日期+第幾組實驗定義 EX:20261013-1]"
                              className="w-full min-w-0 bg-transparent outline-none focus:bg-amber-50 rounded px-1 font-bold text-slate-900 text-xs"
                            />
                            {/* 輸入框浮動提示泡泡 (滿足用戶需求 3) */}
                            <div className="absolute left-3 bottom-full mb-1.5 hidden group-hover:flex group-focus-within:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-[11px] font-medium rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none animate-in fade-in duration-150 border border-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                              <span>[批號定義：日期+第幾組實驗定義 EX:20261013-1]</span>
                              <div className="absolute top-full left-6 border-4 border-transparent border-t-slate-900"></div>
                            </div>
                          </td>
                          <td colSpan={segments[2].span} className="font-bold border-r border-slate-900 bg-slate-50 text-slate-800 px-1">量測日期:</td>
                          <td colSpan={segments[3].span} className="border-r border-slate-900 px-1 text-left">
                            <input 
                              type="text"
                              value={block.measureDate}
                              onChange={(e) => handleUpdateHeader(block.experimentId, 'measureDate', e.target.value)}
                              placeholder="YYYY-MM-DD"
                              className="w-full min-w-0 bg-transparent outline-none focus:bg-amber-50 rounded px-1 text-slate-900 text-xs"
                            />
                          </td>
                          <td colSpan={segments[4].span} className="font-bold border-r border-slate-900 bg-slate-50 text-slate-800 px-1">模具批號</td>
                          <td colSpan={segments[5].span} className="border-r border-slate-900 px-1 text-left">
                            <input 
                              type="text"
                              value={block.moldBatchNumber}
                              onChange={(e) => handleUpdateHeader(block.experimentId, 'moldBatchNumber', e.target.value)}
                              placeholder="模具批號"
                              className="w-full min-w-0 bg-transparent outline-none focus:bg-amber-50 rounded px-1 text-slate-900 text-xs"
                            />
                          </td>
                          <td colSpan={segments[6].span} className="font-bold border-r border-slate-900 bg-slate-50 text-slate-800 px-1">檢測人員:</td>
                          <td colSpan={segments[7].span} className="px-1 text-left">
                            <input 
                              type="text"
                              value={block.operator}
                              onChange={(e) => handleUpdateHeader(block.experimentId, 'operator', e.target.value)}
                              placeholder="檢測人員"
                              className="w-full min-w-0 bg-transparent outline-none focus:bg-amber-50 rounded px-1 text-slate-900 text-xs"
                            />
                          </td>
                        </tr>

                        {/* 表頭第 2 列 */}
                        <tr className="border-b border-slate-900 h-8">
                          <td 
                            colSpan={segments[0].span} 
                            className="font-bold border-r border-slate-900 bg-slate-50 text-slate-800 px-1 relative group cursor-help"
                            title="原始材料(未加起始劑)名稱/批次"
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span>材料名稱/批次</span>
                              <Info className="w-3 h-3 text-slate-400 print:hidden" />
                            </div>
                            {/* 浮動提示泡泡 (滿足用戶需求 4) */}
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-[11px] font-medium rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none animate-in fade-in duration-150 border border-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                              <span>[原始材料(未加起始劑)名稱/批次]</span>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                            </div>
                          </td>
                          <td colSpan={segments[1].span} className="border-r border-slate-900 px-1 text-left relative group">
                            <input 
                              type="text"
                              value={block.formulationName}
                              onChange={(e) => handleUpdateHeader(block.experimentId, 'formulationName', e.target.value)}
                              placeholder="材料配方"
                              title="[原始材料(未加起始劑)名稱/批次]"
                              className="w-full min-w-0 bg-transparent outline-none focus:bg-amber-50 rounded px-1 text-slate-900 text-xs"
                            />
                            {/* 浮動提示泡泡 (滿足用戶需求 4) */}
                            <div className="absolute left-3 bottom-full mb-1.5 hidden group-hover:flex group-focus-within:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-[11px] font-medium rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none animate-in fade-in duration-150 border border-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                              <span>[原始材料(未加起始劑)名稱/批次]</span>
                              <div className="absolute top-full left-6 border-4 border-transparent border-t-slate-900"></div>
                            </div>
                          </td>
                          <td 
                            colSpan={segments[2].span} 
                            className="font-bold border-r border-slate-900 bg-slate-50 text-slate-800 px-1 relative group cursor-help"
                            title="加起始劑、吸收劑或色粉的時間"
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span>配置時間</span>
                              <Info className="w-3 h-3 text-slate-400 print:hidden" />
                            </div>
                            {/* 浮動提示泡泡 (滿足用戶需求 4) */}
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-[11px] font-medium rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none animate-in fade-in duration-150 border border-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                              <span>[加起始劑、吸收劑或色粉的時間]</span>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                            </div>
                          </td>
                          <td colSpan={segments[3].span} className="border-r border-slate-900 px-1 text-left relative group">
                            <input 
                              type="text"
                              value={block.prepareTime}
                              onChange={(e) => handleUpdateHeader(block.experimentId, 'prepareTime', e.target.value)}
                              placeholder="配製時間"
                              title="[加起始劑、吸收劑或色粉的時間]"
                              className="w-full min-w-0 bg-transparent outline-none focus:bg-amber-50 rounded px-1 text-slate-900 text-xs"
                            />
                            {/* 浮動提示泡泡 (滿足用戶需求 4) */}
                            <div className="absolute left-3 bottom-full mb-1.5 hidden group-hover:flex group-focus-within:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-[11px] font-medium rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none animate-in fade-in duration-150 border border-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                              <span>[加起始劑、吸收劑或色粉的時間]</span>
                              <div className="absolute top-full left-6 border-4 border-transparent border-t-slate-900"></div>
                            </div>
                          </td>
                          <td 
                            colSpan={segments[4].span} 
                            className="font-bold border-r border-slate-900 bg-slate-50 text-slate-800 px-1 relative group cursor-help"
                            title="設備編號"
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span>固化設備</span>
                              <Info className="w-3 h-3 text-slate-400 print:hidden" />
                            </div>
                            {/* 浮動提示泡泡 (滿足用戶需求 4) */}
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-[11px] font-medium rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none animate-in fade-in duration-150 border border-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                              <span>[設備編號]</span>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                            </div>
                          </td>
                          <td colSpan={segments[5].span} className="border-r border-slate-900 px-1 text-left relative group">
                            <input 
                              type="text"
                              value={block.curingEquipment}
                              onChange={(e) => handleUpdateHeader(block.experimentId, 'curingEquipment', e.target.value)}
                              placeholder="設備名稱"
                              title="[設備編號]"
                              className="w-full min-w-0 bg-transparent outline-none focus:bg-amber-50 rounded px-1 text-slate-900 text-xs"
                            />
                            {/* 浮動提示泡泡 (滿足用戶需求 4) */}
                            <div className="absolute left-3 bottom-full mb-1.5 hidden group-hover:flex group-focus-within:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-[11px] font-medium rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none animate-in fade-in duration-150 border border-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                              <span>[設備編號]</span>
                              <div className="absolute top-full left-6 border-4 border-transparent border-t-slate-900"></div>
                            </div>
                          </td>
                          <td colSpan={segments[6].span} className="font-bold border-r border-slate-900 bg-slate-50 text-slate-800 px-1">固化能量</td>
                          <td colSpan={segments[7].span} className="px-1 text-left">
                            <input 
                              type="text"
                              value={block.curingEnergy}
                              onChange={(e) => handleUpdateHeader(block.experimentId, 'curingEnergy', e.target.value)}
                              placeholder="例如: 3500 mJ"
                              className="w-full min-w-0 bg-transparent outline-none focus:bg-amber-50 rounded px-1 text-slate-900 text-xs"
                            />
                          </td>
                        </tr>

                        {/* 大分類表頭 (Row 3) */}
                        <tr className="border-b border-slate-900 h-6">
                          <th className="border-r border-slate-900 bg-white"></th>
                          <th colSpan={8} className="border-r border-slate-900 font-bold bg-white text-slate-900 text-[11px]">鏡 片 特 性</th>
                          <th colSpan={N} className="border-r border-slate-900 font-bold bg-white text-slate-900 text-[11px]">鏡 片 缺 陷</th>
                          <th colSpan={3} className="font-bold bg-[#d8b4fe] text-purple-950 text-[11px]">依出貨標準分級</th>
                        </tr>

                        {/* 欄位細稱 (Row 4: DIA跟BC顯示單位 mm，滿足用戶需求 1) */}
                        <tr className="border-b border-slate-900 h-9 bg-white font-medium text-slate-900 text-[11px]">
                          <th className="border-r border-slate-900 px-1 font-bold">樣品</th>
                          <th className="border-r border-slate-900 px-1 leading-tight">DIA<br/><span className="text-[9px] text-slate-500 font-normal">(mm)</span></th>
                          <th className="border-r border-slate-900 px-1 leading-tight">BC<br/><span className="text-[9px] text-slate-500 font-normal">(mm)</span></th>
                          <th className="border-r border-slate-900 px-1 leading-tight">CT<br/><span className="text-[9px] text-slate-500 font-normal">(um)</span></th>
                          <th className="border-r border-slate-900 px-1 leading-tight">ET-1<br/><span className="text-[9px] text-slate-500 font-normal">(um)</span></th>
                          <th className="border-r border-slate-900 px-1 leading-tight">ET-2<br/><span className="text-[9px] text-slate-500 font-normal">(um)</span></th>
                          <th className="border-r border-slate-900 px-1 leading-tight">ET-3<br/><span className="text-[9px] text-slate-500 font-normal">(um)</span></th>
                          <th className="border-r border-slate-900 px-1 leading-tight">ET-4<br/><span className="text-[9px] text-slate-500 font-normal">(um)</span></th>
                          <th className="border-r border-slate-900 px-1 leading-tight">度數<br/><span className="text-[9px] text-slate-500 font-normal">(D)</span></th>
                          
                          {block.defectColumns.map((defName) => (
                            <th 
                              key={defName} 
                              className="border-r border-slate-900 px-0.5 group/th relative font-medium"
                            >
                              <span className="truncate block px-1" title={defName}>{defName}</span>
                              {block.defectColumns.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDefectColumn(block.experimentId, defName)}
                                  className="absolute right-0.5 top-0.5 text-slate-300 hover:text-rose-500 opacity-0 group-hover/th:opacity-100 transition-opacity print:hidden cursor-pointer text-xs"
                                  title={`移除 ${defName} 欄位`}
                                >
                                  ×
                                </button>
                              )}
                            </th>
                          ))}

                          <th className="border-r border-slate-900 px-1 bg-[#ede9fe] text-purple-950 font-bold leading-tight">A級<br/>合格片</th>
                          <th className="border-r border-slate-900 px-1 bg-[#ede9fe] text-purple-950 font-bold leading-tight">B級<br/>合格片</th>
                          <th className="px-1 bg-[#ede9fe] text-purple-950 font-bold leading-tight">C級<br/>不良片</th>
                        </tr>

                        {/* 資料列 (Rows 5+) */}
                        {block.rows.map((row, rIdx) => {
                          const isZebra = rIdx % 2 === 1;
                          return (
                            <tr 
                              key={row.id} 
                              className={cn(
                                "h-8 border-b border-slate-900 transition-colors group",
                                isZebra ? "bg-slate-100" : "bg-white"
                              )}
                            >
                              <td className="border-r border-slate-900 px-1 font-bold relative">
                                <input
                                  type="text"
                                  value={row.sampleCode}
                                  onChange={(e) => handleUpdateRowCell(block.experimentId, row.id, 'sampleCode', e.target.value)}
                                  className="w-full min-w-0 text-center bg-transparent outline-none focus:bg-amber-100 rounded text-[11px] font-bold text-slate-900"
                                />
                                {block.rows.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRow(block.experimentId, row.id)}
                                    className="absolute -left-5 top-1/2 -translate-y-1/2 p-0.5 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all print:hidden cursor-pointer"
                                    title="刪除此列"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </td>

                              <td className="border-r border-slate-900 px-0.5 font-mono">
                                <input
                                  type="text"
                                  value={row.dia}
                                  onChange={(e) => handleUpdateRowCell(block.experimentId, row.id, 'dia', e.target.value)}
                                  className="w-full min-w-0 text-center bg-transparent outline-none focus:bg-amber-100 rounded text-[11px] text-slate-900"
                                />
                              </td>
                              <td className="border-r border-slate-900 px-0.5 font-mono">
                                <input
                                  type="text"
                                  value={row.bc}
                                  onChange={(e) => handleUpdateRowCell(block.experimentId, row.id, 'bc', e.target.value)}
                                  className="w-full min-w-0 text-center bg-transparent outline-none focus:bg-amber-100 rounded text-[11px] text-slate-900"
                                />
                              </td>
                              <td className="border-r border-slate-900 px-0.5 font-mono">
                                <input
                                  type="text"
                                  value={row.ct}
                                  onChange={(e) => handleUpdateRowCell(block.experimentId, row.id, 'ct', e.target.value)}
                                  className="w-full min-w-0 text-center bg-transparent outline-none focus:bg-amber-100 rounded text-[11px] text-slate-900"
                                />
                              </td>
                              <td className="border-r border-slate-900 px-0.5 font-mono">
                                <input
                                  type="text"
                                  value={row.et1}
                                  onChange={(e) => handleUpdateRowCell(block.experimentId, row.id, 'et1', e.target.value)}
                                  className="w-full min-w-0 text-center bg-transparent outline-none focus:bg-amber-100 rounded text-[11px] text-slate-900"
                                />
                              </td>
                              <td className="border-r border-slate-900 px-0.5 font-mono">
                                <input
                                  type="text"
                                  value={row.et2}
                                  onChange={(e) => handleUpdateRowCell(block.experimentId, row.id, 'et2', e.target.value)}
                                  className="w-full min-w-0 text-center bg-transparent outline-none focus:bg-amber-100 rounded text-[11px] text-slate-900"
                                />
                              </td>
                              <td className="border-r border-slate-900 px-0.5 font-mono">
                                <input
                                  type="text"
                                  value={row.et3}
                                  onChange={(e) => handleUpdateRowCell(block.experimentId, row.id, 'et3', e.target.value)}
                                  className="w-full min-w-0 text-center bg-transparent outline-none focus:bg-amber-100 rounded text-[11px] text-slate-900"
                                />
                              </td>
                              <td className="border-r border-slate-900 px-0.5 font-mono">
                                <input
                                  type="text"
                                  value={row.et4}
                                  onChange={(e) => handleUpdateRowCell(block.experimentId, row.id, 'et4', e.target.value)}
                                  className="w-full min-w-0 text-center bg-transparent outline-none focus:bg-amber-100 rounded text-[11px] text-slate-900"
                                />
                              </td>
                              <td className="border-r border-slate-900 px-0.5 font-mono">
                                <input
                                  type="text"
                                  value={row.power}
                                  onChange={(e) => handleUpdateRowCell(block.experimentId, row.id, 'power', e.target.value)}
                                  className="w-full min-w-0 text-center bg-transparent outline-none focus:bg-amber-100 rounded text-[11px] text-slate-900"
                                />
                              </td>

                              {/* 缺陷數據 */}
                              {block.defectColumns.map((defName) => (
                                <td key={defName} className="border-r border-slate-900 px-0.5 font-mono">
                                  <input
                                    type="number"
                                    min="0"
                                    value={row.defects?.[defName] ?? 0}
                                    onChange={(e) => handleUpdateDefectCount(block.experimentId, row.id, defName, parseInt(e.target.value) || 0)}
                                    className="w-full min-w-0 text-center bg-transparent outline-none focus:bg-amber-100 rounded text-[11px] font-bold text-slate-800"
                                  />
                                </td>
                              ))}

                              {/* 出貨分級 */}
                              <td className={cn("border-r border-slate-900 px-0.5 font-bold font-mono", isZebra ? "bg-purple-100/80" : "bg-purple-50")}>
                                <input
                                  type="number"
                                  min="0"
                                  value={row.gradeA}
                                  onChange={(e) => handleUpdateRowCell(block.experimentId, row.id, 'gradeA', parseInt(e.target.value) || 0)}
                                  className="w-full min-w-0 text-center bg-transparent outline-none focus:bg-amber-100 rounded text-emerald-800 font-bold text-[11px]"
                                />
                              </td>
                              <td className={cn("border-r border-slate-900 px-0.5 font-bold font-mono", isZebra ? "bg-purple-100/80" : "bg-purple-50")}>
                                <input
                                  type="number"
                                  min="0"
                                  value={row.gradeB}
                                  onChange={(e) => handleUpdateRowCell(block.experimentId, row.id, 'gradeB', parseInt(e.target.value) || 0)}
                                  className="w-full min-w-0 text-center bg-transparent outline-none focus:bg-amber-100 rounded text-blue-800 font-bold text-[11px]"
                                />
                              </td>
                              <td className={cn("px-0.5 font-bold font-mono", isZebra ? "bg-purple-100/80" : "bg-purple-50")}>
                                <input
                                  type="number"
                                  min="0"
                                  value={row.gradeC}
                                  onChange={(e) => handleUpdateRowCell(block.experimentId, row.id, 'gradeC', parseInt(e.target.value) || 0)}
                                  className="w-full min-w-0 text-center bg-transparent outline-none focus:bg-amber-100 rounded text-rose-800 font-bold text-[11px]"
                                />
                              </td>
                            </tr>
                          );
                        })}

                        {/* 平均 / 總計列 */}
                        {includeSummaryRow && (() => {
                          const sum = calculateBlockSummary(block.rows, block.defectColumns);
                          return (
                            <tr className="h-8 bg-amber-50/80 font-bold text-slate-800 border-t-2 border-slate-900">
                              <td className="border-r border-slate-900 px-1 text-center font-bold text-[11px] text-amber-900">
                                {sum.sampleCode}
                              </td>
                              <td className="border-r border-slate-900 px-1 font-mono text-[11px]">{sum.dia}</td>
                              <td className="border-r border-slate-900 px-1 font-mono text-[11px]">{sum.bc}</td>
                              <td className="border-r border-slate-900 px-1 font-mono text-[11px]">{sum.ct}</td>
                              <td className="border-r border-slate-900 px-1 font-mono text-[11px]">{sum.et1}</td>
                              <td className="border-r border-slate-900 px-1 font-mono text-[11px]">{sum.et2}</td>
                              <td className="border-r border-slate-900 px-1 font-mono text-[11px]">{sum.et3}</td>
                              <td className="border-r border-slate-900 px-1 font-mono text-[11px]">{sum.et4}</td>
                              <td className="border-r border-slate-900 px-1 font-mono text-[11px]">{sum.power}</td>
                              
                              {block.defectColumns.map((defName) => (
                                <td key={defName} className="border-r border-slate-900 px-1 font-mono text-slate-800 text-[11px]">
                                  {sum.defects[defName]}
                                </td>
                              ))}

                              <td className="border-r border-slate-900 px-1 font-mono text-emerald-800 bg-purple-100 text-[11px]">{sum.gradeA}</td>
                              <td className="border-r border-slate-900 px-1 font-mono text-blue-800 bg-purple-100 text-[11px]">{sum.gradeB}</td>
                              <td className="px-1 font-mono text-rose-800 bg-purple-100 text-[11px]">{sum.gradeC}</td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>

                </div>
              );
            })
          )}
        </div>

        {/* Modal Bottom Bar */}
        <div className="px-5 py-3 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>點選儲存格可直接編輯；平均值預設精確至小數點後2位；下拉選單含基礎資料設定與樣品缺陷主檔。</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all cursor-pointer"
            >
              關閉
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-md shadow-rose-100 transition-all cursor-pointer disabled:opacity-50"
            >
              {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              匯出 PDF (A4 橫向{reportBlocks.length > 1 ? ` · 共 ${reportBlocks.length} 頁` : ''})
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-105 text-white rounded-xl font-bold shadow-md shadow-emerald-100 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              確認匯出 Excel ({reportBlocks.length} 筆實驗)
            </button>
          </div>
        </div>

        {/* 匯出 Excel 排版模式選擇對話框 (滿足用戶需求 2: 獨立工作表與連續排版在匯出時再彈出選擇) */}
        {isExportModeModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">選擇 Excel 匯出排版模式</h3>
                    <p className="text-xs text-slate-500">共 {reportBlocks.length} 筆實驗，請選擇工作表組織方式</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsExportModeModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-3">
                <button
                  type="button"
                  onClick={() => executeExcelExport('multi-sheet')}
                  className="w-full text-left p-4 rounded-xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 transition-all group flex items-start gap-3.5 cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 group-hover:text-emerald-700 text-sm">
                        獨立工作表 (多 Sheet 分頁)
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700">
                        推薦
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      每個實驗獨立成一個 Sheet 工作表分頁（以實驗標題命名），方便個別瀏覽與分頁管理。
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => executeExcelExport('single-sheet')}
                  className="w-full text-left p-4 rounded-xl border-2 border-slate-200 hover:border-brand-500 hover:bg-brand-50/40 transition-all group flex items-start gap-3.5 cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center shrink-0 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 group-hover:text-brand-700 text-sm">
                        單一工作表垂直連續排版
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      所有實驗數據集中在同一張 Sheet 內上下連續排版，方便通篇快速滾動比對。
                    </p>
                  </div>
                </button>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setIsExportModeModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
