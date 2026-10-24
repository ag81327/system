import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Upload, 
  Sparkles, 
  Clipboard, 
  Check, 
  RotateCcw, 
  Loader2, 
  CheckCheck,
  Eye,
  SlidersHorizontal,
  X,
  FileSpreadsheet,
  ZoomIn,
  ZoomOut,
  Filter
} from 'lucide-react';
import { cn } from '../lib/utils';
import { runClientSideOCR, preprocessImage, extractSnippet, OCRWordResult } from '../lib/ocrService';

interface OCRDataAssistantProps {
  testItemName?: string;
  onInsertValue: (value: number, snippetUrl?: string) => void;
  onBatchInsert: (values: number[]) => void;
  onClose?: () => void;
}

export const OCRDataAssistant: React.FC<OCRDataAssistantProps> = ({
  testItemName,
  onInsertValue,
  onBatchInsert,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'ocr' | 'clipboard'>('ocr');
  
  // OCR states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [detectedWords, setDetectedWords] = useState<OCRWordResult[]>([]);
  const [usedWordIds, setUsedWordIds] = useState<Set<string>>(new Set());
  const [enhanceHandwriting, setEnhanceHandwriting] = useState(false);
  
  // Natural image dimensions for precise percentage coordinate rendering
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  
  // Zoom level state (100% = original container fit, >100% = zoomed in for fine inspection)
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Column filter state ('all', 'DIA', 'BC', 'CT', 'ET', 'FC', 'summary', or custom)
  const [selectedColumnFilter, setSelectedColumnFilter] = useState<string>('all');

  // Magnifier / preview state
  const [activeSnippet, setActiveSnippet] = useState<{ url: string; val: number } | null>(null);
  
  // Clipboard states
  const [clipboardText, setClipboardText] = useState('');
  const [parsedClipboardNumbers, setParsedClipboardNumbers] = useState<number[]>([]);

  // Auto-detect matching filter based on testItemName prop
  useEffect(() => {
    if (!testItemName) return;
    const nameUpper = testItemName.toUpperCase();
    if (nameUpper.includes('DIA')) {
      setSelectedColumnFilter('DIA');
    } else if (nameUpper.includes('BC')) {
      setSelectedColumnFilter('BC');
    } else if (nameUpper.includes('CT')) {
      setSelectedColumnFilter('CT');
    } else if (nameUpper.includes('FC') || nameUpper.includes('屈光度')) {
      setSelectedColumnFilter('FC');
    } else if (nameUpper.includes('ET')) {
      setSelectedColumnFilter('ET');
    }
  }, [testItemName]);

  // Global paste event listener for quick screenshot (Ctrl+V) paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;

      // Only capture clipboard images at the window level for OCR
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleImageUpload(file);
            setActiveTab('ocr');
            e.preventDefault();
            return;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleImageUpload = (file: File) => {
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setDetectedWords([]);
    setUsedWordIds(new Set());
    setActiveSnippet(null);
    triggerOCR(url, enhanceHandwriting);
  };

  const handleClearImage = () => {
    setImageUrl(null);
    setImageFile(null);
    setDetectedWords([]);
    setUsedWordIds(new Set());
    setActiveSnippet(null);
  };

  const triggerOCR = async (url: string, enhance: boolean) => {
    setIsProcessing(true);
    setProgress(0);
    setStatusText('載入圖片並分析解析度...');

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
        setStatusText('增強對比與筆跡...');
        const canvas = preprocessImage(img, { enhanceHandwriting: true, binarize: true, contrast: 1.35 });
        processedSource = canvas;
      }

      const { words } = await runClientSideOCR(processedSource, {
        enhanceHandwriting: enhance,
        onProgress: (prog, text) => {
          setProgress(Math.round(prog * 100));
          setStatusText(text);
        },
      });

      const wordsWithSnippets = words.map(w => ({
        ...w,
        snippetUrl: extractSnippet(img, w.bbox, 12),
      }));

      setDetectedWords(wordsWithSnippets);
    } catch (err) {
      console.error('OCR Error:', err);
      setStatusText('辨識失敗，請確認圖片格式');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Automatically classify words into column groups based on X coordinates
   * For the optical sheet:
   * - DIA: 40 ~ 85
   * - BC: 95 ~ 145
   * - CT: 155 ~ 210
   * - ET: 220 ~ 450
   * - FC: 455 ~ 515
   * - Summary: bottom row (y > 580)
   */
  const getWordColumnGroup = (word: OCRWordResult): string => {
    const { bbox } = word;
    const midX = (bbox.x0 + bbox.x1) / 2;
    const midY = (bbox.y0 + bbox.y1) / 2;

    if (naturalSize.height > 0 && midY > naturalSize.height * 0.9) {
      return 'summary';
    }

    if (midX >= 35 && midX <= 90) return 'DIA';
    if (midX >= 91 && midX <= 150) return 'BC';
    if (midX >= 151 && midX <= 215) return 'CT';
    if (midX >= 216 && midX <= 455) return 'ET';
    if (midX >= 456 && midX <= 525) return 'FC';

    return 'other';
  };

  // Filtered words based on selected column filter
  const filteredWords = useMemo(() => {
    if (selectedColumnFilter === 'all') return detectedWords;
    return detectedWords.filter(w => getWordColumnGroup(w) === selectedColumnFilter);
  }, [detectedWords, selectedColumnFilter, naturalSize]);

  // Counts per column
  const columnCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: detectedWords.length,
      DIA: 0,
      BC: 0,
      CT: 0,
      ET: 0,
      FC: 0,
      summary: 0,
    };
    for (const w of detectedWords) {
      const g = getWordColumnGroup(w);
      if (counts[g] !== undefined) {
        counts[g]++;
      }
    }
    return counts;
  }, [detectedWords, naturalSize]);

  const handleWordClick = (word: OCRWordResult) => {
    onInsertValue(word.numericValue, word.snippetUrl);
    setUsedWordIds(prev => new Set(prev).add(word.id));
    if (word.snippetUrl) {
      setActiveSnippet({ url: word.snippetUrl, val: word.numericValue });
    }
  };

  const handleBatchInsertCurrent = () => {
    const targetWords = filteredWords.length > 0 ? filteredWords : detectedWords;
    // Sort top-to-bottom, left-to-right
    const sorted = [...targetWords].sort((a, b) => {
      const rowDiff = a.bbox.y0 - b.bbox.y0;
      if (Math.abs(rowDiff) > 15) {
        return rowDiff;
      }
      return a.bbox.x0 - b.bbox.x0;
    });

    const values = sorted.map(w => w.numericValue);
    onBatchInsert(values);
    setUsedWordIds(new Set([...usedWordIds, ...targetWords.map(w => w.id)]));
  };

  // Clipboard parsing
  const handleClipboardChange = (text: string) => {
    setClipboardText(text);
    const parts = text
      .split(/[\r\n\t,;]+/)
      .map(p => p.trim())
      .filter(p => p !== '');

    const numbers: number[] = [];
    for (const part of parts) {
      const match = part.match(/-?\d+(?:\.\d+)?/);
      if (match) {
        const n = parseFloat(match[0]);
        if (!isNaN(n)) numbers.push(n);
      }
    }
    setParsedClipboardNumbers(numbers);
  };

  const handleApplyClipboard = () => {
    if (parsedClipboardNumbers.length > 0) {
      onBatchInsert(parsedClipboardNumbers);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200 overflow-hidden w-full md:w-[58%] lg:w-[62%] flex-shrink-0">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('ocr')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all",
              activeTab === 'ocr'
                ? "bg-white text-brand-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            紙本拍照 / OCR
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('clipboard')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all",
              activeTab === 'clipboard'
                ? "bg-white text-emerald-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel 剪貼簿貼上
          </button>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            title="關閉輔助視窗"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tab 1: OCR Tab */}
      {activeTab === 'ocr' && (
        <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-3 min-h-0">
          {/* Upload Controls & Zoom Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                />
                <div className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 text-xs font-bold text-slate-700 transition-all">
                  <Upload className="w-3.5 h-3.5 text-brand-600" />
                  <span>上傳照片</span>
                </div>
              </label>

              {imageUrl && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !enhanceHandwriting;
                      setEnhanceHandwriting(next);
                      triggerOCR(imageUrl, next);
                    }}
                    disabled={isProcessing}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all",
                      enhanceHandwriting 
                        ? "bg-amber-50 border-amber-300 text-amber-700" 
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                    title="增強黑白對比，改善手寫與模糊"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                    <span>{enhanceHandwriting ? '筆跡增強 ON' : '筆跡增強'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearImage}
                    disabled={isProcessing}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-500 hover:text-rose-600 transition-all"
                    title="清除目前照片，換一張上傳"
                  >
                    清除照片
                  </button>
                </>
              )}
            </div>

            {/* Zoom Controls */}
            {imageUrl && (
              <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 text-xs text-slate-600">
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.max(70, prev - 20))}
                  className="p-1 hover:bg-slate-200 rounded text-slate-500"
                  title="縮小"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono font-bold text-[11px] w-9 text-center">{zoomLevel}%</span>
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.min(200, prev + 20))}
                  className="p-1 hover:bg-slate-200 rounded text-slate-500"
                  title="放大"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(100)}
                  className="ml-1 px-1.5 py-0.5 bg-white border border-slate-200 hover:bg-slate-100 rounded text-[10px] font-bold"
                >
                  重設
                </button>
              </div>
            )}
          </div>

          {/* Processing Banner */}
          {isProcessing && (
            <div className="p-3 bg-brand-50 border border-brand-100 rounded-xl flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-brand-600 animate-spin flex-shrink-0" />
              <div className="flex-1">
                <div className="flex justify-between text-xs font-bold text-brand-900 mb-1">
                  <span>{statusText}</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-brand-200/60 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-brand-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Column Smart Filter Toolbar */}
          {imageUrl && detectedWords.length > 0 && (
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Filter className="w-3.5 h-3.5 text-brand-600" />
                  <span>欄位智能分類篩選</span>
                  <span className="text-[10px] font-normal text-slate-400">（點選欄位只顯示該欄熱區，不再擁擠）</span>
                </div>

                <button
                  type="button"
                  onClick={handleBatchInsertCurrent}
                  className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" />
                  <span>
                    {selectedColumnFilter === 'all' 
                      ? `一鍵填入全部 (${detectedWords.length})` 
                      : `一鍵填入 ${selectedColumnFilter} 欄 (${filteredWords.length})`}
                  </span>
                </button>
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedColumnFilter('all')}
                  className={cn(
                    "px-2 py-0.5 rounded-md text-[11px] font-bold transition-all border",
                    selectedColumnFilter === 'all'
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  全部 ({columnCounts.all})
                </button>

                {columnCounts.DIA > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedColumnFilter('DIA')}
                    className={cn(
                      "px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all border",
                      selectedColumnFilter === 'DIA'
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-blue-50/70 text-blue-700 border-blue-200 hover:bg-blue-100"
                    )}
                  >
                    DIA 欄 ({columnCounts.DIA})
                  </button>
                )}

                {columnCounts.BC > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedColumnFilter('BC')}
                    className={cn(
                      "px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all border",
                      selectedColumnFilter === 'BC'
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-indigo-50/70 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                    )}
                  >
                    BC 欄 ({columnCounts.BC})
                  </button>
                )}

                {columnCounts.CT > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedColumnFilter('CT')}
                    className={cn(
                      "px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all border",
                      selectedColumnFilter === 'CT'
                        ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                        : "bg-purple-50/70 text-purple-700 border-purple-200 hover:bg-purple-100"
                    )}
                  >
                    CT 欄 ({columnCounts.CT})
                  </button>
                )}

                {columnCounts.ET > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedColumnFilter('ET')}
                    className={cn(
                      "px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all border",
                      selectedColumnFilter === 'ET'
                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                        : "bg-amber-50/70 text-amber-700 border-amber-200 hover:bg-amber-100"
                    )}
                  >
                    ET 欄 ({columnCounts.ET})
                  </button>
                )}

                {columnCounts.FC > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedColumnFilter('FC')}
                    className={cn(
                      "px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all border",
                      selectedColumnFilter === 'FC'
                        ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                        : "bg-rose-50/70 text-rose-700 border-rose-200 hover:bg-rose-100"
                    )}
                  >
                    FC (屈光度) 欄 ({columnCounts.FC})
                  </button>
                )}

                {columnCounts.summary > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedColumnFilter('summary')}
                    className={cn(
                      "px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all border",
                      selectedColumnFilter === 'summary'
                        ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                        : "bg-teal-50/70 text-teal-700 border-teal-200 hover:bg-teal-100"
                    )}
                  >
                    結算列 ({columnCounts.summary})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Image & Clean Transparent Hotspot Viewport */}
          {imageUrl ? (
            <div className="flex-1 flex flex-col space-y-2 min-h-0">
              {/* Scrollable Container */}
              <div className="relative flex-1 border border-slate-200 rounded-xl overflow-auto bg-slate-900/5 max-h-[460px] p-2">
                <div 
                  className="relative mx-auto transition-all"
                  style={{ width: `${zoomLevel}%` }}
                >
                  <img
                    src={imageUrl}
                    alt="Excel 表單照片"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
                    }}
                    className="w-full h-auto block select-none pointer-events-none rounded shadow-sm"
                  />

                  {/* Clean Semi-transparent Bounding Hotspots with zero font clutter */}
                  {naturalSize.width > 0 && naturalSize.height > 0 && detectedWords.map((word) => {
                    const colGroup = getWordColumnGroup(word);
                    const isFilteredMatch = selectedColumnFilter === 'all' || colGroup === selectedColumnFilter;
                    const isUsed = usedWordIds.has(word.id);

                    // Skip rendering entirely if filtered out, or hide it
                    if (!isFilteredMatch) return null;

                    // Compute exact percentage position
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
                            ? "bg-emerald-500/15 border-2 border-emerald-500 ring-1 ring-emerald-400/60 z-10"
                            : "bg-blue-500/15 border border-blue-500/70 hover:bg-blue-500/40 hover:border-blue-700 hover:ring-2 hover:ring-blue-400/80 hover:z-20"
                        )}
                      >
                        {/* Hover tooltip floats above the cell without blocking the number */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-slate-900/90 text-white rounded text-[10px] font-mono font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 shadow-md">
                          {word.text} {isUsed ? '(已填)' : '(點擊填入)'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Real handwriting/printed snippet magnifier */}
              {activeSnippet && (
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <Eye className="w-3.5 h-3.5 text-brand-600" />
                      <span>目前點選數值筆跡對照</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      填入值: <strong className="text-slate-900 font-mono text-sm">{activeSnippet.val}</strong>
                    </p>
                  </div>

                  <div className="p-1 bg-slate-100 rounded-lg border border-slate-200">
                    <img
                      src={activeSnippet.url}
                      alt="原圖切片"
                      className="h-9 w-auto object-contain rounded"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-white text-center">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 mb-3 shadow-inner">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800">拖放或上傳紙本 Excel 照片</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                支援手機拍照或截圖。可直接在畫面上按 <kbd className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 font-mono text-[10px]">Ctrl+V</kbd> 貼上截圖。
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Excel Clipboard Paste Tab */}
      {activeTab === 'clipboard' && (
        <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Clipboard className="w-4 h-4 text-emerald-600" />
              從 Excel 複製數值並在此貼上 (Ctrl+V)
            </label>
            {clipboardText && (
              <button
                type="button"
                onClick={() => {
                  setClipboardText('');
                  setParsedClipboardNumbers([]);
                }}
                className="text-[11px] font-bold text-slate-400 hover:text-rose-500 transition-colors"
              >
                清空貼上內容
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed -mt-2">
            在 Excel 選取一整排或一整欄的量測數值按 <kbd className="px-1 py-0.5 bg-slate-100 rounded border border-slate-200 text-[10px] font-mono">Ctrl+C</kbd>，直接在此文字框貼上。
          </p>

          <textarea
            value={clipboardText}
            onChange={(e) => handleClipboardChange(e.target.value)}
            onPaste={(e) => {
              // Directly handle paste and prevent browser double-insertion
              e.preventDefault();
              const text = e.clipboardData.getData('text');
              if (text) {
                handleClipboardChange(text);
              }
            }}
            placeholder="在 Excel 複製後在此處貼上...&#10;例如：&#10;12.45&#9;12.50&#9;12.48&#10;或&#10;12.45&#10;12.50&#10;12.48"
            rows={6}
            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-mono outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-50 transition-all resize-none shadow-sm"
          />

          {parsedClipboardNumbers.length > 0 && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                <span>成功辨識到 {parsedClipboardNumbers.length} 筆數值</span>
              </div>
              
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {parsedClipboardNumbers.map((num, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-white border border-emerald-200 rounded text-xs font-mono font-bold text-emerald-700 shadow-xs"
                  >
                    #{idx + 1}: {num}
                  </span>
                ))}
              </div>

              <button
                type="button"
                onClick={handleApplyClipboard}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                帶入這 {parsedClipboardNumbers.length} 筆數值
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
