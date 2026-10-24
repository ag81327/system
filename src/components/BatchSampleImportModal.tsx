import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Upload, 
  Sparkles, 
  Clipboard, 
  Check, 
  FileSpreadsheet, 
  Loader2, 
  AlertTriangle,
  RotateCcw,
  CheckSquare,
  Square,
  Settings2,
  Plus,
  Trash2,
  Info,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  Filter,
  CheckCheck,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';
import { Sample, TestItem, TestResult, LensDefect, DefectMaster } from '../types';
import { runClientSideOCR, preprocessImage, extractSnippet, OCRWordResult } from '../lib/ocrService';

interface BatchSampleImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  experimentId: string;
  testItems: TestItem[];
  existingSamples?: Sample[];
  defectMasters?: DefectMaster[];
  defectTypes?: string[];
  projectSpecs?: Record<string, { min?: number; max?: number; target?: number }>;
  defaultBatchNumber?: string;
  defaultMoldBatchNumber?: string;
  defaultFormulationName?: string;
  onSaveBatch: (savedSample: Sample, newTestItems?: TestItem[]) => Promise<void>;
}

export interface BatchParsedRow {
  sampleIndex: number;
  sampleCode: string;
  dia?: number;
  bc?: number;
  ct?: number;
  et1?: number;
  et2?: number;
  et3?: number;
  et4?: number;
  fc?: number; // 屈光度
  // Dynamic defects: key is defect name, value is whether it has a defect (打X)
  defects: Record<string, boolean>;
  grainGrade: 'A' | 'B' | 'C' | ''; // 紋路評級
  enabled: boolean;
}

export type MeasColKey = 'dia' | 'bc' | 'ct' | 'et1' | 'et2' | 'et3' | 'et4' | 'fc';

export const BatchSampleImportModal: React.FC<BatchSampleImportModalProps> = ({
  isOpen,
  onClose,
  experimentId,
  testItems,
  existingSamples = [],
  defectMasters = [],
  defectTypes = [],
  projectSpecs,
  defaultBatchNumber = '20260625',
  defaultMoldBatchNumber = '上模 : 0529 #3 / 下模 : 0905 #3',
  defaultFormulationName = '20260625 HIUS10043',
  onSaveBatch,
}) => {
  const [activeTab, setActiveTab] = useState<'paste' | 'file' | 'ocr'>('paste');
  const [pasteText, setPasteText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [pasteFeedback, setPasteFeedback] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Dynamic Defect Types: combine default optical sheet defects with DefectMaster from settings
  const baseDefects = ['雙邊', '凹頂', '毛邊', '氣泡', '異物'];
  const masterNames = (defectMasters || []).map(d => d.name.trim()).filter(Boolean);
  const passedDefectNames = (defectTypes || []).map(d => d.trim()).filter(Boolean);
  const dynamicDefectTypes = Array.from(new Set([...baseDefects, ...masterNames, ...passedDefectNames]));

  // Header metadata (Target Sample Card & Unified Batch)
  const defaultNextCode = `SMP-${(existingSamples.length + 1).toString().padStart(3, '0')}`;
  const [targetSampleOption, setTargetSampleOption] = useState<string>('new');
  const [sampleCode, setSampleCode] = useState(defaultNextCode);
  const [batchNumber, setBatchNumber] = useState(defaultBatchNumber || '20260625');
  const [moldBatchNumber, setMoldBatchNumber] = useState(defaultMoldBatchNumber || '上模 : 0529 #3 / 下模 : 0905 #3');
  const [formulationName, setFormulationName] = useState(defaultFormulationName || '20260625 HIUS10043');
  const [dateStr, setDateStr] = useState('1150629');
  const [operator, setOperator] = useState('張倚絃');

  // Column toggles
  const [columnToggles, setColumnToggles] = useState({
    dia: true,
    bc: true,
    ct: true,
    et1: true,
    et2: true,
    et3: true,
    et4: true,
    fc: true,
    defects: true,
    grain: true,
  });

  // Dynamic sample rows (defaults to 20, resets on modal open)
  const [rows, setRows] = useState<BatchParsedRow[]>([]);

  // Active focused cell for OCR number insertion
  const [activeCell, setActiveCell] = useState<{ rowIdx: number; colKey: MeasColKey } | null>(null);

  // OCR Image State
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [enhanceHandwriting, setEnhanceHandwriting] = useState<boolean>(true);
  const [detectedWords, setDetectedWords] = useState<OCRWordResult[]>([]);
  const [usedWordIds, setUsedWordIds] = useState<Set<string>>(new Set());
  const [selectedColumnFilter, setSelectedColumnFilter] = useState<string>('all');
  const [activeSnippet, setActiveSnippet] = useState<{ val: number; url: string } | null>(null);
  const [showImagePanel, setShowImagePanel] = useState<boolean>(true);

  // Helper to create an empty row
  const createEmptyRow = (index: number): BatchParsedRow => {
    const emptyDefects: Record<string, boolean> = {};
    dynamicDefectTypes.forEach(d => {
      emptyDefects[d] = false;
    });
    return {
      sampleIndex: index,
      sampleCode: `#${index}`,
      defects: emptyDefects,
      grainGrade: '',
      enabled: true,
    };
  };

  // Initialize rows with default 20
  const initDefaultRows = (count = 20) => {
    const initial: BatchParsedRow[] = [];
    for (let i = 1; i <= count; i++) {
      initial.push(createEmptyRow(i));
    }
    setRows(initial);
  };

  // Whenever modal opens or re-opens, ALWAYS reset to default 20 samples
  useEffect(() => {
    if (isOpen) {
      initDefaultRows(20);
      setPasteText('');
      setImageUrl(null);
      setImageFile(null);
      setDetectedWords([]);
      setUsedWordIds(new Set());
      setActiveSnippet(null);
      setActiveCell(null);
      setPasteFeedback(null);
      setIsProcessing(false);
      setProgressText('');
      setProgressPercent(0);

      const nextCode = `SMP-${(existingSamples.length + 1).toString().padStart(3, '0')}`;
      setTargetSampleOption('new');
      setSampleCode(nextCode);
      setBatchNumber(defaultBatchNumber || '20260625');
      setMoldBatchNumber(defaultMoldBatchNumber || '上模 : 0529 #3 / 下模 : 0905 #3');
      setFormulationName(defaultFormulationName || '20260625 HIUS10043');
      setDateStr('1150629');
      setOperator('張倚絃');
      setShowImagePanel(true);

      setTimeout(() => {
        if (activeTab === 'paste') {
          textareaRef.current?.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  // Target Sample Card Selection Handler
  const handleTargetSampleChange = (opt: string) => {
    setTargetSampleOption(opt);
    if (opt === 'new') {
      const nextCode = `SMP-${(existingSamples.length + 1).toString().padStart(3, '0')}`;
      setSampleCode(nextCode);
    } else {
      const found = existingSamples.find(s => s.id === opt);
      if (found) {
        setSampleCode(found.sampleCode);
        if (found.batchNumber) setBatchNumber(found.batchNumber);
        if (found.moldBatchNumber) setMoldBatchNumber(found.moldBatchNumber);
        if (found.formulationName) setFormulationName(found.formulationName);
      }
    }
  };

  // Global Ctrl+V Paste Listener across the whole modal
  useEffect(() => {
    if (!isOpen) return;

    const handleWindowPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;

      // 1. Check for Image in clipboard (e.g. screenshot snipped with Win+Shift+S)
      const items = e.clipboardData.items;
      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              e.preventDefault();
              setActiveTab('ocr');
              setShowImagePanel(true);
              handleImageUpload(file);
              setPasteFeedback('已辨識到剪貼簿截圖，正在載入並執行 OCR 智慧助理...');
              setTimeout(() => setPasteFeedback(null), 4000);
              return;
            }
          }
        }
      }

      // 2. Check for Text / HTML in clipboard
      const html = e.clipboardData.getData('text/html');
      const text = e.clipboardData.getData('text');
      if ((text && text.trim()) || (html && html.includes('<table'))) {
        const target = e.target as HTMLElement;
        const isFocusingTableInput = target && target.tagName === 'INPUT';

        // If user pasted multi-cell / multi-line text OR table HTML OR is not in a single input cell
        if (text.includes('\t') || text.includes('\n') || (html && html.includes('<tr')) || !isFocusingTableInput) {
          e.preventDefault();
          setActiveTab('paste');
          handlePasteExcel(text, html);
          setPasteFeedback('已從剪貼簿成功貼上並解析表格數據（包含文字與顏色標記缺陷）！');
          setTimeout(() => setPasteFeedback(null), 3500);
        }
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => {
      window.removeEventListener('paste', handleWindowPaste);
    };
  }, [isOpen, dynamicDefectTypes, enhanceHandwriting]);

  if (!isOpen) return null;

  // OCR Column Grouping Helper
  const getWordColumnGroup = (word: OCRWordResult): string => {
    const midX = (word.bbox.x0 + word.bbox.x1) / 2;
    if (midX >= 35 && midX <= 90) return 'DIA';
    if (midX >= 91 && midX <= 150) return 'BC';
    if (midX >= 151 && midX <= 215) return 'CT';
    if (midX >= 216 && midX <= 455) return 'ET';
    if (midX >= 456 && midX <= 525) return 'FC';
    return 'other';
  };

  // OCR Image Upload & Recognition Pipeline
  const handleImageUpload = (file: File) => {
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setDetectedWords([]);
    setUsedWordIds(new Set());
    setActiveSnippet(null);
    triggerOCR(url, enhanceHandwriting);
  };

  const triggerOCR = async (url: string, enhance: boolean) => {
    setIsProcessing(true);
    setProgressPercent(10);
    setProgressText('正在載入截圖並分析解析度...');

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const nw = img.naturalWidth || img.width;
      const nh = img.naturalHeight || img.height;
      setNaturalSize({ width: nw, height: nh });

      let processedSource: HTMLCanvasElement | string = url;
      if (enhance) {
        setProgressText('增強對比與筆跡特徵...');
        const canvas = preprocessImage(img, { enhanceHandwriting: true, binarize: true, contrast: 1.35 });
        processedSource = canvas;
      }

      const { words } = await runClientSideOCR(processedSource, {
        enhanceHandwriting: enhance,
        onProgress: (prog, text) => {
          setProgressPercent(Math.round(prog * 100));
          setProgressText(text);
        },
      });

      const wordsWithSnippets = words.map(w => ({
        ...w,
        snippetUrl: extractSnippet(img, w.bbox, 12),
      }));

      setDetectedWords(wordsWithSnippets);
      processDetectedWordsIntoRows(wordsWithSnippets);

      setPasteFeedback(`OCR 辨識完成！共識別到 ${wordsWithSnippets.length} 個數值，已呈現在截圖熱區上。`);
      setTimeout(() => setPasteFeedback(null), 4000);
    } catch (err) {
      console.error('OCR Error:', err);
      alert('截圖 OCR 辨識失敗，請確認圖片清晰度');
    } finally {
      setIsProcessing(false);
    }
  };

  // Auto-fill entire sheet from OCR detected words
  const processDetectedWordsIntoRows = (words: OCRWordResult[]) => {
    if (words.length === 0) return;

    const numRowsToDetect = Math.max(20, rows.length);
    const newRows: BatchParsedRow[] = [];

    for (let i = 1; i <= numRowsToDetect; i++) {
      const rowYCenter = 150 + (i - 1) * 21.4;
      const rowWords = words.filter(w => Math.abs((w.bbox.y0 + w.bbox.y1) / 2 - rowYCenter) < 11);

      const findColVal = (minX: number, maxX: number) => {
        const w = rowWords.find(w => {
          const mx = (w.bbox.x0 + w.bbox.x1) / 2;
          return mx >= minX && mx <= maxX;
        });
        return w ? w.numericValue : undefined;
      };

      const initialDefects: Record<string, boolean> = {};
      dynamicDefectTypes.forEach(d => { initialDefects[d] = false; });

      newRows.push({
        sampleIndex: i,
        sampleCode: `#${i}`,
        dia: findColVal(35, 90),
        bc: findColVal(91, 150),
        ct: findColVal(151, 215),
        et1: findColVal(216, 275),
        et2: findColVal(276, 335),
        et3: findColVal(336, 395),
        et4: findColVal(396, 455),
        fc: findColVal(456, 525), // FC (屈光度)
        defects: initialDefects,
        grainGrade: '',
        enabled: true,
      });
    }

    setRows(newRows);
  };

  // Interactive Tag Click on Image (Inserts into active focused cell)
  const handleWordClick = (word: OCRWordResult) => {
    const val = word.numericValue;
    if (val === undefined || isNaN(val)) return;

    setUsedWordIds(prev => new Set(prev).add(word.id));
    if (word.snippetUrl) {
      setActiveSnippet({ val, url: word.snippetUrl });
    }

    let targetRow = activeCell?.rowIdx ?? 0;
    let targetCol = activeCell?.colKey;

    if (!targetCol) {
      const grp = getWordColumnGroup(word);
      if (grp === 'DIA') targetCol = 'dia';
      else if (grp === 'BC') targetCol = 'bc';
      else if (grp === 'CT') targetCol = 'ct';
      else if (grp === 'ET') targetCol = 'et1';
      else if (grp === 'FC') targetCol = 'fc';
      else targetCol = 'dia';
    }

    setRows(prev => {
      const next = [...prev];
      while (next.length <= targetRow) {
        next.push(createEmptyRow(next.length + 1));
      }
      next[targetRow] = {
        ...next[targetRow],
        [targetCol!]: val,
      };
      return next;
    });

    const nextRow = targetRow + 1;
    setActiveCell({ rowIdx: nextRow, colKey: targetCol });
  };

  // Helper to extract colored cell coordinates ("r,c") from XLSX styles.xml and worksheet xml
  const extractColoredCellsFromXLSX = (buffer: ArrayBuffer, targetSheetName: string, workbook: XLSX.WorkBook): Set<string> => {
    const coloredCoords = new Set<string>();
    try {
      const u8 = new Uint8Array(buffer);
      const cfb = XLSX.CFB.read(u8, { type: 'buffer' });
      const stylesEntry = cfb.FileIndex.find(f => f.name.endsWith('styles.xml'));
      if (!stylesEntry || !stylesEntry.content) return coloredCoords;

      const stylesXml = typeof stylesEntry.content === 'string'
        ? stylesEntry.content
        : new TextDecoder('utf-8').decode(new Uint8Array(stylesEntry.content));

      // 1. Identify fill indices that have user color (non-none, non-gray125, non-white)
      const fillMatches = stylesXml.match(/<fill>[\s\S]*?<\/fill>/g) || [];
      const coloredFillIndices = new Set<number>();
      fillMatches.forEach((f, idx) => {
        if (idx === 0 || idx === 1) return; // 0=none, 1=gray125
        if (f.includes('patternType="none"')) return;

        const hasFg = f.includes('<fgColor') || f.includes('fgColor=');
        const hasBg = f.includes('<bgColor') || f.includes('bgColor=');
        const isSolid = f.includes('patternType="solid"');
        const isWhite = f.includes('rgb="FFFFFFFF"') || f.includes('rgb="FFFFFF"') || (f.includes('theme="0"') && !f.includes('tint='));

        if ((hasFg || hasBg || isSolid) && !isWhite) {
          coloredFillIndices.add(idx);
        }
      });

      // 2. Identify cellXfs styles that reference a colored fillId
      const cellXfsBlock = stylesXml.match(/<cellXfs[\s\S]*?<\/cellXfs>/)?.[0] || '';
      const xfMatches = cellXfsBlock.match(/<xf[\s\S]*?\/>/g) || cellXfsBlock.match(/<xf[\s\S]*?<\/xf>/g) || [];
      const coloredStyleIndices = new Set<number>();
      xfMatches.forEach((xf, idx) => {
        const fillMatch = xf.match(/fillId="(\d+)"/);
        if (fillMatch) {
          const fillId = parseInt(fillMatch[1], 10);
          if (coloredFillIndices.has(fillId)) {
            coloredStyleIndices.add(idx);
          }
        }
      });

      if (coloredStyleIndices.size === 0) return coloredCoords;

      // 3. Find the worksheet xml
      const sheetIdx = workbook.SheetNames.indexOf(targetSheetName) + 1;
      const sheetEntry = cfb.FileIndex.find(f => f.name.endsWith(`sheet${sheetIdx}.xml`)) 
                      || cfb.FileIndex.find(f => f.name.includes('sheet') && f.name.endsWith('.xml'));
      if (!sheetEntry || !sheetEntry.content) return coloredCoords;

      const sheetXml = typeof sheetEntry.content === 'string'
        ? sheetEntry.content
        : new TextDecoder('utf-8').decode(new Uint8Array(sheetEntry.content));

      // 4. Find all cell tags with style index in coloredStyleIndices
      const cMatches = sheetXml.match(/<c\s+[^>]+>/g) || [];
      cMatches.forEach(tag => {
        const rMatch = tag.match(/\br="([A-Z0-9]+)"/);
        const sMatch = tag.match(/\bs="(\d+)"/);
        if (rMatch && sMatch) {
          const sIdx = parseInt(sMatch[1], 10);
          if (coloredStyleIndices.has(sIdx)) {
            const coord = XLSX.utils.decode_cell(rMatch[1]);
            coloredCoords.add(`${coord.r},${coord.c}`);
          }
        }
      });
    } catch (err) {
      console.warn('Could not extract cell colors from XLSX:', err);
    }
    return coloredCoords;
  };

  // Helper to parse HTML table from Excel clipboard copy (extracts cells and background colors)
  const parseHtmlTable = (html: string): { matrix: string[][]; coloredCoords: Set<string> } | null => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const rows = doc.querySelectorAll('tr');
      if (rows.length === 0) return null;

      const matrix: string[][] = [];
      const coloredCoords = new Set<string>();

      rows.forEach((tr, rIdx) => {
        const rowData: string[] = [];
        const cells = tr.querySelectorAll('td, th');
        cells.forEach((cell, cIdx) => {
          const text = (cell.textContent || '').trim();
          rowData.push(text);

          const el = cell as HTMLElement;
          const bgAttr = el.getAttribute('bgcolor') || '';
          const bgStyle = el.style.backgroundColor || el.style.background || '';

          const isColored = (
            (bgAttr && bgAttr !== '#ffffff' && bgAttr !== '#FFFFFF' && bgAttr !== 'white') ||
            (bgStyle &&
             !bgStyle.includes('transparent') &&
             !bgStyle.includes('rgba(0, 0, 0, 0)') &&
             !bgStyle.includes('255, 255, 255') &&
             !bgStyle.includes('#fff') &&
             !bgStyle.includes('#FFF'))
          );

          if (isColored) {
            coloredCoords.add(`${rIdx},${cIdx}`);
          }
        });
        if (rowData.length > 0) {
          matrix.push(rowData);
        }
      });

      return matrix.length > 0 ? { matrix, coloredCoords } : null;
    } catch {
      return null;
    }
  };

  // Parser for 2D cell matrix (from Excel file or clipboard paste)
  const process2DDataMatrix = (matrix: string[][], coloredCoords?: Set<string>) => {
    if (!matrix || matrix.length === 0) return;

    // Helper to get the next non-empty string in the row (handles merged cells)
    const getNextVal = (row: string[], startIdx: number): string => {
      for (let i = startIdx + 1; i < row.length; i++) {
        const val = (row[i] || '').trim();
        if (val) return val;
      }
      return '';
    };

    // 1. Scan top header metadata (Mold, Formulation/Material, Date, Operator, Batch)
    for (let r = 0; r < Math.min(8, matrix.length); r++) {
      const row = matrix[r];
      if (!Array.isArray(row)) continue;

      for (let c = 0; c < row.length; c++) {
        const cell = (row[c] || '').toString().trim();
        if (!cell) continue;

        // Extract inline value if cell has a colon (e.g., "模具: 上模 : 0529 #3 / 下模 : 0905 #3")
        let inlineVal = '';
        if (cell.includes(':') || cell.includes('：')) {
          const splitIdx = cell.search(/[:：]/);
          if (splitIdx !== -1) {
            inlineVal = cell.substring(splitIdx + 1).trim();
          }
        }

        const nextVal = inlineVal || getNextVal(row, c);

        // Mold
        if (cell.includes('模具') && nextVal) {
          setMoldBatchNumber(nextVal);
        }

        // Material / Formulation
        if ((cell.includes('配方') || cell.includes('材料') || cell.includes('品名') || cell.includes('產品')) && nextVal) {
          setFormulationName(nextVal);
          const autoBatch = nextVal.split(' ')[0] || nextVal;
          setBatchNumber(autoBatch);
        }

        // Measurement Date
        if ((cell.includes('日期') || cell.includes('量測日')) && nextVal) {
          setDateStr(nextVal);
        }

        // Inspection Personnel / Operator
        if ((cell.includes('人員') || cell.includes('檢測人') || cell.includes('檢驗人') || cell.includes('操作人')) && nextVal) {
          setOperator(nextVal);
        }

        // Explicit Batch Number
        if (cell.includes('批號') && !cell.includes('模具') && nextVal) {
          setBatchNumber(nextVal);
        }
      }
    }

    // 2. Locate the table header row
    let headerRowIdx = -1;
    for (let r = 0; r < matrix.length; r++) {
      const rowStr = (matrix[r] || []).map(c => (c || '').toString().trim()).join(' ').toUpperCase();
      if (
        (rowStr.includes('DIA') || rowStr.includes('直徑')) &&
        (rowStr.includes('BC') || rowStr.includes('基弧') || rowStr.includes('弧度'))
      ) {
        headerRowIdx = r;
        break;
      }
    }

    // Fallback if DIA and BC are not on the same line
    if (headerRowIdx === -1) {
      for (let r = 0; r < matrix.length; r++) {
        const rowStr = (matrix[r] || []).map(c => (c || '').toString().trim()).join(' ').toUpperCase();
        if (rowStr.includes('DIA') || rowStr.includes('BC') || rowStr.includes('直徑') || rowStr.includes('基弧')) {
          headerRowIdx = r;
          break;
        }
      }
    }

    const colMap: {
      dia?: number;
      bc?: number;
      ct?: number;
      et1?: number;
      et2?: number;
      et3?: number;
      et4?: number;
      fc?: number;
      grain?: number;
      defects: Record<string, number>;
    } = {
      defects: {}
    };

    if (headerRowIdx !== -1) {
      const headerRow = matrix[headerRowIdx];
      headerRow.forEach((colName, cIdx) => {
        const raw = (colName || '').toString().trim();
        const cleanName = raw.toUpperCase().replace(/[\s\-_]/g, '');
        if (!cleanName) return;

        if (cleanName === 'DIA' || cleanName.includes('直徑')) colMap.dia = cIdx;
        else if (cleanName === 'BC' || cleanName.includes('基弧') || cleanName.includes('弧度')) colMap.bc = cIdx;
        else if (cleanName === 'CT' || cleanName.includes('中心厚')) colMap.ct = cIdx;
        else if (cleanName === 'ET1' || cleanName.includes('邊厚1')) colMap.et1 = cIdx;
        else if (cleanName === 'ET2' || cleanName.includes('邊厚2')) colMap.et2 = cIdx;
        else if (cleanName === 'ET3' || cleanName.includes('邊厚3')) colMap.et3 = cIdx;
        else if (cleanName === 'ET4' || cleanName.includes('邊厚4')) colMap.et4 = cIdx;
        else if (cleanName.includes('FC') || cleanName.includes('屈光度') || cleanName.includes('度數')) colMap.fc = cIdx;
        else if (cleanName.includes('紋路') || cleanName.includes('評級') || cleanName.includes('等級')) colMap.grain = cIdx;

        // Only map defect columns if this column is not the grain column
        if (colMap.grain !== cIdx) {
          for (const defName of dynamicDefectTypes) {
            if (raw.includes(defName) || cleanName.includes(defName.toUpperCase())) {
              colMap.defects[defName] = cIdx;
            }
          }
        }
      });
    }

    const startDataRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
    const parsed: BatchParsedRow[] = [];

    const parseNum = (val: any): number | undefined => {
      if (val === undefined || val === null || val === '') return undefined;
      if (typeof val === 'number') return isNaN(val) ? undefined : val;
      const s = String(val).trim();
      if (s === '' || s === '-' || s === 'X' || s === 'x' || s === 'N/A' || s === 'NA' || s === '無') return undefined;
      const n = parseFloat(s);
      return isNaN(n) ? undefined : n;
    };

    const parseDefectVal = (val: any): boolean => {
      if (!val && val !== 0) return false;
      const s = String(val).trim().toUpperCase();
      return (
        s === 'X' ||
        s === '1' ||
        s === 'V' ||
        s === 'TRUE' ||
        s === 'YES' ||
        s === '有' ||
        s === '✓' ||
        s === '✔' ||
        s === '✕' ||
        s === '✖' ||
        s === 'O' ||
        s === 'OK'
      );
    };

    const parseGrade = (val: any): 'A' | 'B' | 'C' | '' => {
      if (!val) return '';
      const s = String(val).trim().toUpperCase();
      if (s === 'A') return 'A';
      if (s === 'B') return 'B';
      if (s === 'C') return 'C';
      return '';
    };

    let sampleNum = 1;
    for (let r = startDataRow; r < matrix.length; r++) {
      const row = matrix[r];
      if (!row || row.length === 0) continue;

      // Stop scanning if reaching summary rows
      const isSummaryRow = row.some(c => {
        const str = (c || '').toString().trim();
        return (
          str.includes('結') ||
          str.includes('平均') ||
          str.includes('總計') ||
          str.includes('合計') ||
          str.includes('MAX') ||
          str.includes('MIN') ||
          str.includes('SPEC') ||
          str.includes('規格')
        );
      });
      if (isSummaryRow && parsed.length > 0) break;

      const hasContent = row.some(c => (c || '').toString().trim() !== '');
      if (!hasContent) continue;

      let colOffset = 0;
      let sCode = `#${sampleNum}`;
      const firstColStr = (row[0] || '').toString().trim();
      const firstColNum = parseInt(firstColStr, 10);
      const isExplicitSampleIndex =
        !isNaN(firstColNum) && firstColNum >= 1 && firstColNum <= 500 && String(firstColNum) === firstColStr;

      if (isExplicitSampleIndex) {
        colOffset = 1;
        sCode = `#${firstColNum}`;
      } else if (
        firstColStr.startsWith('#') ||
        firstColStr.startsWith('SMP') ||
        firstColStr.startsWith('S-') ||
        firstColStr.startsWith('樣品')
      ) {
        colOffset = 1;
        sCode = firstColStr;
      }

      const dia = colMap.dia !== undefined ? parseNum(row[colMap.dia]) : parseNum(row[colOffset]);
      const bc = colMap.bc !== undefined ? parseNum(row[colMap.bc]) : parseNum(row[colOffset + 1]);
      const ct = colMap.ct !== undefined ? parseNum(row[colMap.ct]) : parseNum(row[colOffset + 2]);
      const et1 = colMap.et1 !== undefined ? parseNum(row[colMap.et1]) : parseNum(row[colOffset + 3]);
      const et2 = colMap.et2 !== undefined ? parseNum(row[colMap.et2]) : parseNum(row[colOffset + 4]);
      const et3 = colMap.et3 !== undefined ? parseNum(row[colMap.et3]) : parseNum(row[colOffset + 5]);
      const et4 = colMap.et4 !== undefined ? parseNum(row[colMap.et4]) : parseNum(row[colOffset + 6]);
      const fc = colMap.fc !== undefined ? parseNum(row[colMap.fc]) : parseNum(row[colOffset + 7]);

      // Check both text marker and background color mark
      const isDefectCell = (rIdx: number, cIdx?: number): boolean => {
        if (cIdx === undefined || cIdx < 0 || cIdx >= row.length) return false;
        // 1. Text marker: 'X', '1', 'V', 'TRUE', 'YES', '有', '✓', etc.
        const val = row[cIdx];
        if (parseDefectVal(val)) return true;
        // 2. Cell background color marker (table color highlighting from Excel / clipboard)
        if (coloredCoords && coloredCoords.has(`${rIdx},${cIdx}`)) {
          return true;
        }
        return false;
      };

      const rowDefects: Record<string, boolean> = {};
      dynamicDefectTypes.forEach((defName, dIdx) => {
        if (colMap.defects[defName] !== undefined) {
          // 1. Column exists in Excel header
          rowDefects[defName] = isDefectCell(r, colMap.defects[defName]);
        } else if (headerRowIdx === -1) {
          // 2. Only use positional fallback if NO header row was found at all
          const fallbackCol = colOffset + 8 + dIdx;
          const maxDefectCol = colMap.grain !== undefined ? colMap.grain - 1 : row.length - 1;
          if (fallbackCol <= maxDefectCol && fallbackCol < row.length) {
            rowDefects[defName] = isDefectCell(r, fallbackCol);
          } else {
            rowDefects[defName] = false;
          }
        } else {
          // 3. Header row exists in Excel, but this defect column is NOT in this Excel sheet
          rowDefects[defName] = false;
        }
      });

      const grainGrade = colMap.grain !== undefined 
        ? parseGrade(row[colMap.grain]) 
        : (headerRowIdx === -1 ? parseGrade(row[colOffset + 8 + 5]) : '');

      const hasMeasurement = [dia, bc, ct, et1, et2, et3, et4, fc].some(v => v !== undefined);
      const hasDefect = Object.values(rowDefects).some(Boolean);
      const hasGrain = grainGrade !== '';

      // Skip the defect total count row (which has no sample index, no measurements, only numbers in defect columns)
      if (!isExplicitSampleIndex && !hasMeasurement && !firstColStr.startsWith('#')) {
        continue;
      }

      if (hasMeasurement || hasDefect || hasGrain || isExplicitSampleIndex) {
        parsed.push({
          sampleIndex: isExplicitSampleIndex ? firstColNum : sampleNum,
          sampleCode: sCode,
          dia,
          bc,
          ct,
          et1,
          et2,
          et3,
          et4,
          fc,
          defects: rowDefects,
          grainGrade,
          enabled: true,
        });
        sampleNum++;
      }
    }

    if (parsed.length > 0) {
      setRows(parsed);
    }
  };

  const handlePasteExcel = (text: string, html?: string) => {
    setPasteText(text);
    if (!text.trim() && !html) return;

    if (html && (html.includes('<table') || html.includes('<td'))) {
      const parsedTable = parseHtmlTable(html);
      if (parsedTable && parsedTable.matrix.length > 0) {
        process2DDataMatrix(parsedTable.matrix, parsedTable.coloredCoords);
        return;
      }
    }

    const lines = text.trim().split(/\r?\n/);
    const matrix = lines.map(line => line.split('\t').map(c => c.trim()));
    process2DDataMatrix(matrix);
  };

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setProgressText('正在解析 Excel 檔案...');

    try {
      let rawMatrix: any[][] = [];
      let coloredCoords = new Set<string>();
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'csv') {
        const text = await file.text();
        const workbook = XLSX.read(text, { type: 'string' });
        const firstSheet = workbook.SheetNames[0];
        rawMatrix = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1, defval: '' });
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });

        // Auto-detect sheet with optical measurements if multiple sheets exist
        let targetSheetName = workbook.SheetNames[0];
        for (const name of workbook.SheetNames) {
          const ws = workbook.Sheets[name];
          if (!ws || !ws['!ref']) continue;
          const sampleMatrix: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          const hasKeyword = sampleMatrix.some(r =>
            Array.isArray(r) &&
            r.some(c => {
              const s = String(c || '').toUpperCase();
              return (
                s.includes('DIA') ||
                s.includes('BC') ||
                s.includes('模具') ||
                s.includes('材料') ||
                s.includes('配方') ||
                s.includes('直徑') ||
                s.includes('量測')
              );
            })
          );
          if (hasKeyword) {
            targetSheetName = name;
            break;
          }
        }

        const worksheet = workbook.Sheets[targetSheetName];
        rawMatrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        // Extract colored cell coordinates from styles.xml and worksheet xml
        coloredCoords = extractColoredCellsFromXLSX(buffer, targetSheetName, workbook);
      }

      // Sanitize rawMatrix into 100% string[][] to ensure .trim() or string ops never crash on number cells
      const matrix: string[][] = (rawMatrix || []).map(row =>
        Array.isArray(row)
          ? row.map(cell => (cell === null || cell === undefined ? '' : String(cell).trim()))
          : []
      );

      if (matrix.length === 0 || !matrix.some(r => r.length > 0)) {
        throw new Error('檔案中沒有可讀取的資料列');
      }

      process2DDataMatrix(matrix, coloredCoords);
      const colorCount = coloredCoords.size;
      setPasteFeedback(
        `已成功匯入檔案「${file.name}」！共解析 ${matrix.length} 列資料${
          colorCount > 0 ? `（包含 ${colorCount} 處表格顏色標記缺陷）` : ''
        }`
      );
      setTimeout(() => setPasteFeedback(null), 3500);
    } catch (err: any) {
      console.error('File parse error:', err);
      alert(`Excel 檔案解析失敗: ${err?.message || '請確認格式'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Row operations
  const updateRow = <K extends keyof BatchParsedRow>(index: number, key: K, val: BatchParsedRow[K]) => {
    setRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: val };
      return next;
    });
  };

  const toggleRowDefect = (rowIndex: number, defectName: string) => {
    setRows(prev => {
      const next = [...prev];
      const curDefects = { ...next[rowIndex].defects };
      curDefects[defectName] = !curDefects[defectName];
      next[rowIndex] = { ...next[rowIndex], defects: curDefects };
      return next;
    });
  };

  const handleAddSingleGroup = () => {
    const nextIdx = rows.length + 1;
    setRows(prev => [...prev, createEmptyRow(nextIdx)]);
  };

  const handleAddFiveGroups = () => {
    setRows(prev => {
      const next = [...prev];
      const startIdx = prev.length + 1;
      for (let i = 0; i < 5; i++) {
        next.push(createEmptyRow(startIdx + i));
      }
      return next;
    });
  };

  const handleDeleteRow = (index: number) => {
    setRows(prev => prev.filter((_, idx) => idx !== index));
  };

  // Confirm and Save: Aggregates all lens rows into ONE single Sample Card!
  const handleConfirmSave = async () => {
    const enabledRows = rows.filter(r => r.enabled);
    if (enabledRows.length === 0) {
      alert('請至少勾選一筆要建立的鏡片數據');
      return;
    }

    setIsProcessing(true);
    const uniformBatch = batchNumber.trim() || 'B1';
    const finalSampleCode = sampleCode.trim() || `SMP-${(existingSamples.length + 1).toString().padStart(3, '0')}`;
    setProgressText(`正在將此批 ${enabledRows.length} 片鏡片數據統整寫入樣品卡片「${finalSampleCode}」...`);

    try {
      const newItemsToCreate: TestItem[] = [];
      const getOrCreateTestItem = (name: string, unit: string, aliases: string[] = []) => {
        const searchNames = [name, ...aliases].map(s => s.toLowerCase());
        let found = testItems.find(t => searchNames.includes(t.name.toLowerCase())) ||
                    newItemsToCreate.find(t => searchNames.includes(t.name.toLowerCase()));
        if (!found) {
          found = {
            id: `item_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
            name,
            unit,
          };
          newItemsToCreate.push(found);
        }
        return found;
      };

      const itemDIA = getOrCreateTestItem('DIA', 'mm');
      const itemBC = getOrCreateTestItem('BC', 'mm');
      const itemCT = getOrCreateTestItem('CT', 'μm');
      const itemET1 = getOrCreateTestItem('ET-1', 'μm');
      const itemET2 = getOrCreateTestItem('ET-2', 'μm');
      const itemET3 = getOrCreateTestItem('ET-3', 'μm');
      const itemET4 = getOrCreateTestItem('ET-4', 'μm');
      const itemFC = getOrCreateTestItem('FC (屈光度)', 'D', ['FC', '屈光度', 'FC (屈光度)', '焦距', '度數']);

      // Target Sample ID (either update existing or create new)
      const sampleId = targetSampleOption !== 'new' 
        ? targetSampleOption 
        : `s_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      // Aggregate all lens measurements into rawValues & mean for each TestItem
      const results: TestResult[] = [];
      const calculateTestResult = (testItem: TestItem, valKey: MeasColKey) => {
        if (!columnToggles[valKey]) return;

        const validVals: number[] = [];
        enabledRows.forEach(r => {
          const v = r[valKey];
          if (v !== undefined && !isNaN(v)) {
            validVals.push(v);
          }
        });

        if (validVals.length === 0) return;

        const sum = validVals.reduce((acc, v) => acc + v, 0);
        const mean = Number((sum / validVals.length).toFixed(3));
        const variance = validVals.length > 1 
          ? validVals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (validVals.length - 1)
          : 0;
        const stdDev = Number(Math.sqrt(variance).toFixed(3));
        const max = Math.max(...validVals);
        const min = Math.min(...validVals);

        const spec = projectSpecs?.[testItem.id] || (testItem.specMin !== undefined || testItem.specMax !== undefined ? { min: testItem.specMin, max: testItem.specMax } : undefined);
        let status: 'Pass' | 'Fail' | 'Warning' = 'Pass';
        if (spec) {
          if (spec.min !== undefined && mean < spec.min) status = 'Fail';
          else if (spec.max !== undefined && mean > spec.max) status = 'Fail';
        }

        results.push({
          id: `res_${sampleId}_${testItem.id}`,
          sampleId,
          testItemId: testItem.id,
          rawValues: validVals,
          mean,
          stdDev,
          max,
          min,
          isAnomaly: false,
          status,
        });
      };

      calculateTestResult(itemDIA, 'dia');
      calculateTestResult(itemBC, 'bc');
      calculateTestResult(itemCT, 'ct');
      calculateTestResult(itemET1, 'et1');
      calculateTestResult(itemET2, 'et2');
      calculateTestResult(itemET3, 'et3');
      calculateTestResult(itemET4, 'et4');
      calculateTestResult(itemFC, 'fc');

      // Aggregate Defect Statistics across all lenses in this batch
      const defects: LensDefect[] = [];
      if (columnToggles.defects) {
        dynamicDefectTypes.forEach(defName => {
          const count = enabledRows.filter(r => r.defects[defName]).length;
          if (count > 0) {
            defects.push({
              id: `d_${sampleId}_${encodeURIComponent(defName)}`,
              type: defName,
              count,
            });
          }
        });
      }

      // Aggregate Grain Grade Counts across all lenses in this batch
      const gradeA = columnToggles.grain ? enabledRows.filter(r => r.grainGrade === 'A').length : 0;
      const gradeB = columnToggles.grain ? enabledRows.filter(r => r.grainGrade === 'B').length : 0;
      const gradeC = columnToggles.grain ? enabledRows.filter(r => r.grainGrade === 'C').length : 0;

      // Detailed per-lens rows for expandable view and detailed reporting
      const lensRows = enabledRows.map(r => ({
        index: r.sampleIndex,
        code: r.sampleCode,
        dia: r.dia,
        bc: r.bc,
        ct: r.ct,
        et1: r.et1,
        et2: r.et2,
        et3: r.et3,
        et4: r.et4,
        fc: r.fc,
        defects: { ...r.defects },
        grainGrade: r.grainGrade,
      }));

      // Build the single unified Sample card
      const singleBatchSample: Sample = {
        id: sampleId,
        experimentId,
        sampleCode: finalSampleCode,
        batchNumber: uniformBatch,
        moldBatchNumber: moldBatchNumber.trim(),
        formulationName: formulationName.trim(),
        curingEnergy: '',
        createdAt: new Date().toISOString(),
        gradeA,
        gradeB,
        gradeC,
        defects,
        results,
        lensRows,
      };

      await onSaveBatch(singleBatchSample, newItemsToCreate.length > 0 ? newItemsToCreate : undefined);
      onClose();
    } catch (err) {
      console.error('Batch save error:', err);
      alert('建立樣品卡片寫入資料庫失敗，請檢查網路連線或數據格式');
    } finally {
      setIsProcessing(false);
    }
  };

  const enabledCount = rows.filter(r => r.enabled).length;

  const columnCounts = {
    all: detectedWords.length,
    DIA: detectedWords.filter(w => getWordColumnGroup(w) === 'DIA').length,
    BC: detectedWords.filter(w => getWordColumnGroup(w) === 'BC').length,
    CT: detectedWords.filter(w => getWordColumnGroup(w) === 'CT').length,
    ET: detectedWords.filter(w => getWordColumnGroup(w) === 'ET').length,
    FC: detectedWords.filter(w => getWordColumnGroup(w) === 'FC').length,
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-slate-900/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[98vw] xl:max-w-7xl max-h-[96vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex-shrink-0 px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-brand-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">智能新增樣品</h3>
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[11px] font-bold rounded border border-indigo-200">
                  同一批數據統整為同一樣品卡片
                </span>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded border border-emerald-200">
                  支援 Ctrl+V 貼上截圖與表格
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                整批鏡片量測值與外觀缺陷將整合至同一個樣品卡片中（自動計算各項目平均值、標準差與缺陷總數）。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {imageUrl && (
              <button
                type="button"
                onClick={() => setShowImagePanel(!showImagePanel)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all text-slate-700 bg-slate-50 hover:bg-slate-100 cursor-pointer"
              >
                {showImagePanel ? <PanelLeftClose className="w-4 h-4 text-indigo-600" /> : <PanelLeftOpen className="w-4 h-4 text-indigo-600" />}
                <span>{showImagePanel ? '收合截圖對照' : '展開截圖對照'}</span>
              </button>
            )}

            <button 
              type="button"
              onClick={onClose} 
              className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-slate-50 flex flex-col">
          {/* Notification / Paste Feedback Banner */}
          {pasteFeedback && (
            <div className="px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700 flex items-center gap-2 animate-in fade-in duration-150 flex-shrink-0">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{pasteFeedback}</span>
            </div>
          )}

          {/* Source Tabs & Mode Bar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex-shrink-0 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('paste');
                    setTimeout(() => textareaRef.current?.focus(), 50);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                    activeTab === 'paste' ? "bg-white text-emerald-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  Excel 整張複製貼上 (支援 Ctrl+V)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('ocr')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                    activeTab === 'ocr' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  紙本拍照 / 截圖 OCR 助理 (支援 Ctrl+V 貼上截圖)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('file')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                    activeTab === 'file' ? "bg-white text-brand-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  上傳 .xlsx 檔案
                </button>
              </div>

              {isProcessing && (
                <div className="flex items-center gap-2 text-xs font-bold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-xl border border-brand-200">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{progressText}</span>
                  {progressPercent > 0 && <span>({progressPercent}%)</span>}
                </div>
              )}
            </div>

            {/* Tab 1: Paste Input */}
            {activeTab === 'paste' && (
              <div className="space-y-1.5">
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={pasteText}
                    onChange={(e) => handlePasteExcel(e.target.value)}
                    onPaste={(e) => {
                      e.preventDefault();
                      const text = e.clipboardData.getData('text');
                      if (text) handlePasteExcel(text);
                    }}
                    placeholder="在 Excel 選取檢測表格後按 Ctrl+C，接著在此處直接按 Ctrl+V 貼上即可（自動識別表頭、樣品編號、量測值與缺陷打X）..."
                    rows={2}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-50 transition-all resize-none"
                  />
                  <div className="absolute right-2.5 bottom-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) handlePasteExcel(text);
                        } catch (err) {
                          alert('請直接在鍵盤上按 Ctrl+V 進行貼上');
                        }
                      }}
                      className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-[11px] font-bold shadow-2xs flex items-center gap-1 cursor-pointer"
                    >
                      <Clipboard className="w-3 h-3 text-emerald-600" />
                      從剪貼簿讀取
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: OCR Upload Bar */}
            {activeTab === 'ocr' && !imageUrl && (
              <label className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-xl p-5 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-indigo-50/20 hover:bg-indigo-50/40 transition-all">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageUpload(f);
                  }}
                />
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs">
                  <Upload className="w-4 h-4" />
                  <span>點此上傳檢測表照片 / 截圖檔案，或直接在視窗按 <strong>Ctrl+V</strong> 貼上剪貼簿截圖</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  貼上截圖後即可如同輸入測試數據一樣，直接點擊圖片上的數字填入樣品矩陣！
                </p>
              </label>
            )}

            {/* Tab 3: File Upload */}
            {activeTab === 'file' && (
              <label className="border-2 border-dashed border-slate-200 hover:border-brand-400 rounded-xl p-4 flex items-center justify-center gap-3 cursor-pointer bg-slate-50/50 hover:bg-brand-50/30 transition-all">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                    e.target.value = '';
                  }}
                />
                <FileSpreadsheet className="w-5 h-5 text-brand-600" />
                <span className="text-xs font-bold text-slate-700">點此上傳或拖放 Excel 檔案 (.xlsx / .csv)</span>
              </label>
            )}
          </div>

          {/* Split Container: Left OCR Image Assistant + Right Matrix Table */}
          <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
            {/* Left: OCR Image Assistant Panel */}
            {imageUrl && showImagePanel && (
              <div className="lg:w-1/2 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs p-3 space-y-2.5 min-h-[480px]">
                {/* Assistant Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-950 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      OCR 智慧助理截圖對照
                    </span>
                    <span className="text-[10px] text-slate-400">
                      點擊圖片藍框可直接填入右側儲存格
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Zoom Controls */}
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                      <button
                        type="button"
                        onClick={() => setZoomLevel(prev => Math.max(50, prev - 15))}
                        className="p-1 hover:bg-white rounded text-slate-600"
                        title="縮小"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-1 font-mono text-[11px] font-bold text-slate-600 min-w-[36px] text-center">
                        {zoomLevel}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setZoomLevel(prev => Math.min(220, prev + 15))}
                        className="p-1 hover:bg-white rounded text-slate-600"
                        title="放大"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoomLevel(100)}
                        className="p-1 hover:bg-white rounded text-slate-600"
                        title="重設大小"
                      >
                        <Maximize2 className="w-3 h-3" />
                      </button>
                    </div>

                    <label className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold cursor-pointer transition-all">
                      更換圖片
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleImageUpload(f);
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Column Filter Pills */}
                {detectedWords.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
                        <Filter className="w-3 h-3" /> 欄位篩選:
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedColumnFilter('all')}
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold transition-all border",
                          selectedColumnFilter === 'all' ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"
                        )}
                      >
                        全部 ({columnCounts.all})
                      </button>
                      {columnCounts.DIA > 0 && (
                        <button
                          type="button"
                          onClick={() => { setSelectedColumnFilter('DIA'); setActiveCell(prev => ({ rowIdx: prev?.rowIdx ?? 0, colKey: 'dia' })); }}
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold transition-all border",
                            selectedColumnFilter === 'DIA' ? "bg-blue-600 text-white border-blue-600" : "bg-white text-blue-700 border-blue-200"
                          )}
                        >
                          DIA ({columnCounts.DIA})
                        </button>
                      )}
                      {columnCounts.BC > 0 && (
                        <button
                          type="button"
                          onClick={() => { setSelectedColumnFilter('BC'); setActiveCell(prev => ({ rowIdx: prev?.rowIdx ?? 0, colKey: 'bc' })); }}
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold transition-all border",
                            selectedColumnFilter === 'BC' ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-indigo-700 border-indigo-200"
                          )}
                        >
                          BC ({columnCounts.BC})
                        </button>
                      )}
                      {columnCounts.CT > 0 && (
                        <button
                          type="button"
                          onClick={() => { setSelectedColumnFilter('CT'); setActiveCell(prev => ({ rowIdx: prev?.rowIdx ?? 0, colKey: 'ct' })); }}
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold transition-all border",
                            selectedColumnFilter === 'CT' ? "bg-purple-600 text-white border-purple-600" : "bg-white text-purple-700 border-purple-200"
                          )}
                        >
                          CT ({columnCounts.CT})
                        </button>
                      )}
                      {columnCounts.ET > 0 && (
                        <button
                          type="button"
                          onClick={() => { setSelectedColumnFilter('ET'); setActiveCell(prev => ({ rowIdx: prev?.rowIdx ?? 0, colKey: 'et1' })); }}
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold transition-all border",
                            selectedColumnFilter === 'ET' ? "bg-amber-600 text-white border-amber-600" : "bg-white text-amber-700 border-amber-200"
                          )}
                        >
                          ET ({columnCounts.ET})
                        </button>
                      )}
                      {columnCounts.FC > 0 && (
                        <button
                          type="button"
                          onClick={() => { setSelectedColumnFilter('FC'); setActiveCell(prev => ({ rowIdx: prev?.rowIdx ?? 0, colKey: 'fc' })); }}
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold transition-all border",
                            selectedColumnFilter === 'FC' ? "bg-rose-600 text-white border-rose-600" : "bg-white text-rose-700 border-rose-200"
                          )}
                        >
                          FC (屈光度) ({columnCounts.FC})
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => processDetectedWordsIntoRows(detectedWords)}
                      className="px-2.5 py-1 bg-gradient-to-r from-brand-600 to-indigo-600 text-white rounded-lg text-[10px] font-bold shadow-xs flex items-center gap-1 cursor-pointer hover:brightness-105"
                      title="自動依照光學表格欄列對齊，整張辨識寫入右側"
                    >
                      <CheckCheck className="w-3 h-3" />
                      一鍵全表自動帶入
                    </button>
                  </div>
                )}

                {/* Active Focus Target Display */}
                {activeCell && (
                  <div className="px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-lg text-[11px] font-bold text-indigo-800 flex items-center justify-between">
                    <span>
                      🎯 目前輸入目標: 鏡片 <strong className="text-indigo-950 font-mono">{rows[activeCell.rowIdx]?.sampleCode || `#${activeCell.rowIdx + 1}`}</strong> 的 <strong className="text-indigo-950 uppercase">{activeCell.colKey}</strong> 欄
                    </span>
                    <span className="text-[10px] text-indigo-500 font-normal">
                      點擊截圖上的數字即可直接填入並自動跳下一列
                    </span>
                  </div>
                )}

                {/* Interactive Image Canvas Viewport */}
                <div className="flex-1 overflow-auto border border-slate-200 rounded-xl bg-slate-900/5 p-2 relative min-h-[300px]">
                  <div 
                    className="relative mx-auto transition-all"
                    style={{ width: `${zoomLevel}%` }}
                  >
                    <img
                      src={imageUrl}
                      alt="檢測表截圖"
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
                      }}
                      className="w-full h-auto block select-none pointer-events-none rounded shadow-sm"
                    />

                    {/* Interactive Hotspot Bounding Boxes */}
                    {naturalSize.width > 0 && naturalSize.height > 0 && detectedWords.map((word) => {
                      const colGroup = getWordColumnGroup(word);
                      const isFilteredMatch = selectedColumnFilter === 'all' || colGroup === selectedColumnFilter;
                      const isUsed = usedWordIds.has(word.id);

                      if (!isFilteredMatch) return null;

                      const leftPct = (word.bbox.x0 / naturalSize.width) * 100;
                      const topPct = (word.bbox.y0 / naturalSize.height) * 100;
                      const widthPct = Math.max(1.8, ((word.bbox.x1 - word.bbox.x0) / naturalSize.width) * 100);
                      const heightPct = Math.max(1.6, ((word.bbox.y1 - word.bbox.y0) / naturalSize.height) * 100);

                      return (
                        <div
                          key={word.id}
                          onClick={() => handleWordClick(word)}
                          style={{
                            position: 'absolute',
                            left: `${leftPct}%`,
                            top: `${topPct}%`,
                            width: `${widthPct}%`,
                            height: `${heightPct}%`,
                          }}
                          className={cn(
                            "group absolute cursor-pointer rounded transition-all",
                            isUsed
                              ? "bg-emerald-500/20 border-2 border-emerald-500 ring-1 ring-emerald-400 z-10"
                              : "bg-blue-500/20 border border-blue-500 hover:bg-blue-500/40 hover:border-blue-700 hover:ring-2 hover:ring-blue-400 z-15"
                          )}
                        >
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-slate-900/90 text-white rounded text-[10px] font-mono font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 shadow-md">
                            {word.text} {isUsed ? '(已填)' : '(點擊填入)'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Handwriting Magnifier Snippet */}
                {activeSnippet && (
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                        <Eye className="w-3 h-3 text-brand-600" />
                        <span>點選數字切片對照</span>
                      </div>
                      <p className="text-xs text-slate-700 mt-0.5">
                        數值: <strong className="text-slate-900 font-mono text-sm">{activeSnippet.val}</strong>
                      </p>
                    </div>

                    <div className="p-1 bg-white rounded-lg border border-slate-200">
                      <img
                        src={activeSnippet.url}
                        alt="切片放大"
                        className="h-8 w-auto object-contain rounded"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Right: Metadata + Sample Matrix Table */}
            <div className={cn(
              "flex-1 flex flex-col space-y-3 min-h-0",
              imageUrl && showImagePanel ? "lg:w-1/2" : "w-full"
            )}>
              {/* 1. 樣品資訊 (統整為單一樣品卡片) */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    1. 樣品資訊
                  </span>
                  <span className="text-[11px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded">
                    整批數據將統整為【{sampleCode}】卡片
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                  {/* Target Card Option */}
                  <div>
                    <label className="text-slate-500 font-bold block mb-1">目標樣品卡片</label>
                    <select
                      value={targetSampleOption}
                      onChange={(e) => handleTargetSampleChange(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold text-slate-800 focus:bg-white focus:border-brand-500"
                    >
                      <option value="new">＋ 建立新卡片</option>
                      {existingSamples.map(s => (
                        <option key={s.id} value={s.id}>
                          更新: {s.sampleCode} ({s.batchNumber})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sample Code */}
                  <div>
                    <label className="text-slate-500 font-bold block mb-1">
                      樣品編號 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={sampleCode}
                      onChange={(e) => setSampleCode(e.target.value)}
                      placeholder="例如: SMP-001"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold text-slate-900 focus:bg-white focus:border-brand-500"
                    />
                  </div>

                  {/* Batch Number */}
                  <div>
                    <label className="text-slate-500 font-bold block mb-1">
                      統一批次編號 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={batchNumber}
                      onChange={(e) => setBatchNumber(e.target.value)}
                      placeholder="例如: 20260625"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-indigo-200 rounded-lg outline-none font-bold text-indigo-900 focus:bg-white focus:border-indigo-500 ring-1 ring-indigo-50"
                    />
                  </div>

                  {/* Formulation Name */}
                  <div>
                    <label className="text-slate-500 font-bold block mb-1">配方名稱</label>
                    <input
                      type="text"
                      value={formulationName}
                      onChange={(e) => setFormulationName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none font-medium focus:bg-white focus:border-brand-500"
                    />
                  </div>

                  {/* Mold Batch */}
                  <div>
                    <label className="text-slate-500 font-bold block mb-1">模具批號</label>
                    <input
                      type="text"
                      value={moldBatchNumber}
                      onChange={(e) => setMoldBatchNumber(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none font-medium focus:bg-white focus:border-brand-500"
                    />
                  </div>

                  {/* Date & Operator */}
                  <div>
                    <label className="text-slate-500 font-bold block mb-1">量測日期 / 人員</label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={dateStr}
                        onChange={(e) => setDateStr(e.target.value)}
                        placeholder="日期"
                        className="w-1/2 px-1.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-[11px] font-medium"
                      />
                      <input
                        type="text"
                        value={operator}
                        onChange={(e) => setOperator(e.target.value)}
                        placeholder="人員"
                        className="w-1/2 px-1.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-[11px] font-medium"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sample Matrix Preview Table */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex-1 flex flex-col space-y-2.5 min-h-[360px]">
                <div className="flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      2. 鏡片數據矩陣 (共 {rows.length} 組鏡片，已選取 {enabledCount} 組)
                    </span>
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded border border-purple-200">
                      基礎資料缺陷: 共 {dynamicDefectTypes.length} 種
                    </span>
                  </div>

                  {/* Add sample groups buttons */}
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={handleAddSingleGroup}
                      className="px-2.5 py-1 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-lg font-bold border border-brand-200 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      新增 1 組樣品
                    </button>
                    <button
                      type="button"
                      onClick={handleAddFiveGroups}
                      className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-bold border border-indigo-200 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      新增5 組樣品
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setRows(rows.map(r => ({ ...r, enabled: true })))}
                      className="text-brand-600 hover:underline font-bold cursor-pointer"
                    >
                      全選
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setRows(rows.map(r => ({ ...r, enabled: false })))}
                      className="text-slate-400 hover:underline cursor-pointer"
                    >
                      全取消
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => initDefaultRows(20)}
                      className="text-slate-400 hover:text-slate-700 text-[11px] cursor-pointer"
                      title="重設為預設 20 組鏡片"
                    >
                      重設 20 組
                    </button>
                  </div>
                </div>

                {/* Scrollable Data Grid */}
                <div className="flex-1 overflow-x-auto border border-slate-200 rounded-xl max-h-[460px] overflow-y-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-20 shadow-xs">
                      <tr>
                        <th className="p-2 border-b border-r border-slate-200 text-center w-10">納入</th>
                        <th className="p-2 border-b border-r border-slate-200 text-center w-16">鏡片編號</th>
                        
                        {/* Measurement Columns with Toggles */}
                        <th className="p-2 border-b border-r border-slate-200 text-center w-20">
                          <label className="flex items-center justify-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={columnToggles.dia}
                              onChange={(e) => setColumnToggles({ ...columnToggles, dia: e.target.checked })}
                              className="rounded text-brand-600"
                            />
                            <span>DIA</span>
                          </label>
                        </th>

                        <th className="p-2 border-b border-r border-slate-200 text-center w-20">
                          <label className="flex items-center justify-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={columnToggles.bc}
                              onChange={(e) => setColumnToggles({ ...columnToggles, bc: e.target.checked })}
                              className="rounded text-brand-600"
                            />
                            <span>BC</span>
                          </label>
                        </th>

                        <th className="p-2 border-b border-r border-slate-200 text-center w-20">
                          <label className="flex items-center justify-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={columnToggles.ct}
                              onChange={(e) => setColumnToggles({ ...columnToggles, ct: e.target.checked })}
                              className="rounded text-brand-600"
                            />
                            <span>CT</span>
                          </label>
                        </th>

                        <th className="p-2 border-b border-r border-slate-200 text-center w-20">
                          <label className="flex items-center justify-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={columnToggles.et1}
                              onChange={(e) => setColumnToggles({ ...columnToggles, et1: e.target.checked })}
                              className="rounded text-brand-600"
                            />
                            <span>ET-1</span>
                          </label>
                        </th>

                        <th className="p-2 border-b border-r border-slate-200 text-center w-20">
                          <label className="flex items-center justify-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={columnToggles.et2}
                              onChange={(e) => setColumnToggles({ ...columnToggles, et2: e.target.checked })}
                              className="rounded text-brand-600"
                            />
                            <span>ET-2</span>
                          </label>
                        </th>

                        <th className="p-2 border-b border-r border-slate-200 text-center w-20">
                          <label className="flex items-center justify-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={columnToggles.et3}
                              onChange={(e) => setColumnToggles({ ...columnToggles, et3: e.target.checked })}
                              className="rounded text-brand-600"
                            />
                            <span>ET-3</span>
                          </label>
                        </th>

                        <th className="p-2 border-b border-r border-slate-200 text-center w-20">
                          <label className="flex items-center justify-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={columnToggles.et4}
                              onChange={(e) => setColumnToggles({ ...columnToggles, et4: e.target.checked })}
                              className="rounded text-brand-600"
                            />
                            <span>ET-4</span>
                          </label>
                        </th>

                        {/* FC (屈光度) */}
                        <th className="p-2 border-b border-r border-slate-200 text-center w-28">
                          <label className="flex items-center justify-center gap-1 cursor-pointer" title="FC 即為屈光度 (Diopter, 單位 D)">
                            <input
                              type="checkbox"
                              checked={columnToggles.fc}
                              onChange={(e) => setColumnToggles({ ...columnToggles, fc: e.target.checked })}
                              className="rounded text-brand-600"
                            />
                            <span>FC (屈光度)</span>
                          </label>
                        </th>

                        {/* Defect Columns */}
                        <th className="p-2 border-b border-r border-slate-200 text-center min-w-[220px]">
                          <label className="flex items-center justify-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={columnToggles.defects}
                              onChange={(e) => setColumnToggles({ ...columnToggles, defects: e.target.checked })}
                              className="rounded text-brand-600"
                            />
                            <span>外觀缺陷 (打X)</span>
                          </label>
                        </th>

                        {/* Grain Grade Column */}
                        <th className="p-2 border-b border-r border-slate-200 text-center w-32">
                          <label className="flex items-center justify-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={columnToggles.grain}
                              onChange={(e) => setColumnToggles({ ...columnToggles, grain: e.target.checked })}
                              className="rounded text-brand-600"
                            />
                            <span>紋路評級</span>
                          </label>
                        </th>

                        {/* Row delete */}
                        <th className="p-2 border-b border-slate-200 text-center w-10">操作</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 bg-white font-mono">
                      {rows.map((row, rIdx) => {
                        const isRowActive = activeCell?.rowIdx === rIdx;

                        return (
                          <tr 
                            key={row.sampleIndex} 
                            className={cn(
                              "hover:bg-slate-50/80 transition-colors",
                              !row.enabled && "opacity-40 bg-slate-50/50",
                              isRowActive && "bg-indigo-50/20"
                            )}
                          >
                            {/* Row Enabled Checkbox */}
                            <td className="p-2 border-r border-slate-100 text-center">
                              <input
                                type="checkbox"
                                checked={row.enabled}
                                onChange={(e) => updateRow(rIdx, 'enabled', e.target.checked)}
                                className="rounded text-brand-600 cursor-pointer"
                              />
                            </td>

                            {/* Sample Code Input */}
                            <td className="p-1 border-r border-slate-100 text-center">
                              <input
                                type="text"
                                value={row.sampleCode}
                                onChange={(e) => updateRow(rIdx, 'sampleCode', e.target.value)}
                                className="w-16 text-center py-1 bg-transparent border border-transparent hover:border-slate-200 focus:border-brand-500 rounded font-bold text-slate-800"
                              />
                            </td>

                            {/* Measurement inputs with interactive focus highlighting for OCR */}
                            {(['dia', 'bc', 'ct', 'et1', 'et2', 'et3', 'et4', 'fc'] as const).map(colKey => {
                              const isCellFocused = activeCell?.rowIdx === rIdx && activeCell?.colKey === colKey;
                              const isColEnabled = columnToggles[colKey];

                              return (
                                <td key={colKey} className="p-1 border-r border-slate-100 text-center">
                                  <input
                                    type="number"
                                    step="any"
                                    value={row[colKey] ?? ''}
                                    placeholder="-"
                                    disabled={!isColEnabled}
                                    onFocus={() => setActiveCell({ rowIdx: rIdx, colKey })}
                                    onChange={(e) => updateRow(rIdx, colKey, e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                    className={cn(
                                      "w-16 text-center py-1 bg-transparent border rounded transition-all disabled:opacity-30",
                                      isCellFocused 
                                        ? "border-indigo-500 bg-indigo-50 font-bold text-indigo-900 ring-2 ring-indigo-200" 
                                        : "border-transparent hover:border-slate-200 focus:border-brand-500"
                                    )}
                                  />
                                </td>
                              );
                            })}

                            {/* Dynamic Defect Badges from Base Settings */}
                            <td className="p-1.5 border-r border-slate-100 text-center">
                              <div className="flex flex-wrap items-center justify-center gap-1 font-sans">
                                {dynamicDefectTypes.map(defName => {
                                  const isSet = !!row.defects[defName];
                                  return (
                                    <button
                                      key={defName}
                                      type="button"
                                      disabled={!columnToggles.defects}
                                      onClick={() => toggleRowDefect(rIdx, defName)}
                                      className={cn(
                                        "px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer",
                                        isSet
                                          ? "bg-purple-100 border-purple-400 text-purple-700 shadow-2xs ring-1 ring-purple-300"
                                          : "bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100",
                                        !columnToggles.defects && "opacity-30 cursor-not-allowed"
                                      )}
                                      title={`點擊切換 ${defName} 是否有缺陷 (打X)`}
                                    >
                                      {defName} {isSet ? '✕' : ''}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>

                            {/* Grain Grade Select */}
                            <td className="p-1.5 border-r border-slate-100 text-center">
                              <div className="flex items-center justify-center gap-1 font-sans">
                                {(['A', 'B', 'C'] as const).map(g => (
                                  <button
                                    key={g}
                                    type="button"
                                    disabled={!columnToggles.grain}
                                    onClick={() => updateRow(rIdx, 'grainGrade', row.grainGrade === g ? '' : g)}
                                    className={cn(
                                      "w-6 h-6 rounded flex items-center justify-center font-bold text-xs border transition-all cursor-pointer",
                                      row.grainGrade === g
                                        ? g === 'A' 
                                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                          : g === 'B'
                                          ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                                          : "bg-amber-600 text-white border-amber-600 shadow-xs"
                                        : "bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-700",
                                      !columnToggles.grain && "opacity-30 cursor-not-allowed"
                                    )}
                                  >
                                    {g}
                                  </button>
                                ))}
                              </div>
                            </td>

                            {/* Row Delete Button */}
                            <td className="p-1 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(rIdx)}
                                className="p-1 text-slate-300 hover:text-rose-500 rounded transition-colors cursor-pointer"
                                title="刪除此組鏡片"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Bottom Add Row Bar */}
                <div className="flex items-center justify-between pt-1 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddSingleGroup}
                      className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1 cursor-pointer bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-200"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      新增 1 組樣品
                    </button>
                    <button
                      type="button"
                      onClick={handleAddFiveGroups}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      新增5 組樣品
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    目前共有 {rows.length} 組鏡片，已選取 {enabledCount} 組（將自動彙整至【{sampleCode}】卡片）
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex-shrink-0 p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center justify-between z-10">
          <div className="text-xs text-slate-500 font-medium">
            統一批次：<strong className="text-indigo-700 font-bold">{batchNumber || '未填寫'}</strong> | 
            樣品卡片：<strong className="text-slate-900 font-bold">{sampleCode}</strong> | 
            統整此批 <strong className="text-brand-600 font-bold">{enabledCount}</strong> 筆鏡片量測數據與缺陷統計
          </div>

          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
            >
              取消返回
            </button>
            <button 
              type="button"
              onClick={handleConfirmSave}
              disabled={isProcessing || enabledCount === 0}
              className="px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-brand-600 to-indigo-600 rounded-xl hover:brightness-105 transition-all shadow-lg shadow-brand-200 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>確認建立 1 組樣品卡片 (統整此批 {enabledCount} 顆鏡片數據)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
