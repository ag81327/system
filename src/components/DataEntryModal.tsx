import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Calculator, AlertTriangle, RotateCcw, Sparkles, Eye } from 'lucide-react';
import { cn } from '../lib/utils';
import { TestItem } from '../types';
import { OCRDataAssistant } from './OCRDataAssistant';

interface DataEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  testItem: TestItem;
  specMin?: number;
  specMax?: number;
  targetValue?: number;
  initialValues?: number[];
  onSave: (values: number[]) => void;
}

export const DataEntryModal = ({ 
  isOpen, 
  onClose, 
  testItem, 
  specMin, 
  specMax, 
  targetValue, 
  initialValues = [], 
  onSave 
}: DataEntryModalProps) => {
  const [values, setValues] = useState<string[]>(
    initialValues.length > 0 ? initialValues.map(v => v.toString()) : ['']
  );

  const [showConfirm, setShowConfirm] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [snippets, setSnippets] = useState<Record<number, string>>({});
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Sync initial values when modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setValues(initialValues.length > 0 ? initialValues.map(v => v.toString()) : ['']);
      setShowConfirm(false);
      setSnippets({});
      setFocusedIndex(0);
    }
  }, [initialValues, isOpen]);

  // Support ESC key to cancel/close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAddValue = () => {
    setValues([...values, '']);
    setTimeout(() => {
      inputRefs.current[values.length]?.focus();
      setFocusedIndex(values.length);
    }, 50);
  };

  const handleRemoveValue = (index: number) => {
    if (values.length > 1) {
      setValues(values.filter((_, i) => i !== index));
      const newSnippets = { ...snippets };
      delete newSnippets[index];
      setSnippets(newSnippets);
    } else {
      setValues(['']);
      setSnippets({});
    }
  };

  const handleValueChange = (index: number, val: string) => {
    // If user pastes multiple values (separated by newlines, commas, or spaces)
    if (val.includes('\n') || val.includes('\t') || (val.includes(',') && val.split(',').length > 1)) {
      const parts = val
        .split(/[\n\t,]+/)
        .map(p => p.trim())
        .filter(p => p !== '');
      if (parts.length > 1) {
        const newValues = [...values];
        newValues.splice(index, 1, ...parts);
        setValues(newValues);
        return;
      }
    }

    const newValues = [...values];
    newValues[index] = val;
    setValues(newValues);
  };

  const handleClearAll = () => {
    setValues(['']);
    setSnippets({});
    setFocusedIndex(0);
  };

  // OCR Single Click Insert
  const handleAssistantInsert = (val: number, snippetUrl?: string) => {
    let targetIdx = focusedIndex;
    
    // If the focused slot already has a value, find the first empty slot or append
    if (values[targetIdx] && values[targetIdx].trim() !== '') {
      const firstEmpty = values.findIndex(v => v.trim() === '');
      if (firstEmpty !== -1) {
        targetIdx = firstEmpty;
      } else {
        targetIdx = values.length;
      }
    }

    const newValues = [...values];
    newValues[targetIdx] = val.toString();
    setValues(newValues);

    if (snippetUrl) {
      setSnippets(prev => ({ ...prev, [targetIdx]: snippetUrl }));
    }

    // Auto focus next input
    const nextIdx = targetIdx + 1;
    setFocusedIndex(nextIdx);
    setTimeout(() => {
      if (inputRefs.current[nextIdx]) {
        inputRefs.current[nextIdx]?.focus();
      } else {
        // Auto append empty point if at the end
        setValues(prev => [...prev, '']);
        setTimeout(() => inputRefs.current[nextIdx]?.focus(), 50);
      }
    }, 50);
  };

  // Batch insert from OCR or Excel Clipboard
  const handleAssistantBatchInsert = (newNumbers: number[]) => {
    if (newNumbers.length === 0) return;
    setValues(newNumbers.map(n => n.toString()));
    setSnippets({});
    setFocusedIndex(0);
  };

  const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
  const mean = numericValues.length > 0 ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length : 0;
  
  const isOutOfSpec = (specMin !== undefined && mean < specMin) || 
                      (specMax !== undefined && mean > specMax);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className={cn(
          "bg-white rounded-2xl shadow-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 transition-all",
          showAssistant ? "max-w-6xl xl:max-w-7xl" : "max-w-lg"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white z-10">
          <div>
            <h3 className="text-lg font-bold text-slate-900">輸入測試數據</h3>
            <p className="text-xs text-slate-500">{testItem.name} ({testItem.unit})</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAssistant(!showAssistant)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm border",
                showAssistant
                  ? "bg-brand-50 border-brand-300 text-brand-700 ring-2 ring-brand-100"
                  : "bg-gradient-to-r from-brand-600 to-indigo-600 text-white border-transparent hover:opacity-95"
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{showAssistant ? '收合智慧助理' : '開啟 OCR / Excel 智慧助理'}</span>
            </button>

            <button 
              type="button"
              onClick={onClose} 
              className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              title="關閉 (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Container: 2-Column when Assistant is active */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left Drawer / Panel: OCR & Excel Assistant */}
          {showAssistant && (
            <OCRDataAssistant
              testItemName={testItem.name}
              onInsertValue={handleAssistantInsert}
              onBatchInsert={handleAssistantBatchInsert}
              onClose={() => setShowAssistant(false)}
            />
          )}

          {/* Right Panel: Value Entry & Spec Review */}
          <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6 min-h-0">
            {/* Spec Info */}
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">規格範圍</p>
                <p className="text-sm font-bold text-slate-900">
                  {specMin ?? '-'} ~ {specMax ?? '-'} {testItem.unit}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">目標值</p>
                <p className="text-sm font-bold text-brand-600">{targetValue ?? '-'} {testItem.unit}</p>
              </div>
            </div>

            {/* Values List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  量測數值 (共 {values.length} 點)
                </label>
                <button 
                  type="button"
                  onClick={handleClearAll}
                  className="text-[10px] font-bold text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  清除全部
                </button>
              </div>

              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {values.map((val, index) => {
                  const num = parseFloat(val);
                  const isValOutOfSpec = !isNaN(num) && (
                    (specMin !== undefined && num < specMin) || 
                    (specMax !== undefined && num > specMax)
                  );
                  const snippet = snippets[index];
                  
                  return (
                    <div 
                      key={index} 
                      className={cn(
                        "flex items-center gap-3 p-1.5 rounded-xl transition-all",
                        focusedIndex === index && showAssistant ? "bg-brand-50/50 ring-1 ring-brand-200" : ""
                      )}
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400 flex-shrink-0">
                        {index + 1}
                      </div>

                      <div className="flex-1 relative flex items-center gap-2">
                        <input 
                          ref={(el) => { inputRefs.current[index] = el; }}
                          type="number" 
                          step="any"
                          value={val}
                          onFocus={() => setFocusedIndex(index)}
                          onChange={(e) => handleValueChange(index, e.target.value)}
                          placeholder="0.00"
                          className={cn(
                            "w-full px-4 py-2 bg-slate-50 border rounded-lg text-sm outline-none transition-all font-mono",
                            isValOutOfSpec 
                              ? "border-rose-300 bg-rose-50/50 text-rose-700 focus:ring-rose-100" 
                              : "border-slate-200 focus:bg-white focus:border-brand-500 focus:ring-brand-50"
                          )}
                        />

                        {/* Handwriting Snippet thumbnail for instant verification */}
                        {snippet && (
                          <div 
                            className="flex-shrink-0 h-8 px-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs flex items-center gap-1"
                            title="原圖對應筆跡"
                          >
                            <Eye className="w-3 h-3 text-slate-400" />
                            <img src={snippet} alt="筆跡" className="h-6 w-auto object-contain rounded" />
                          </div>
                        )}

                        {isValOutOfSpec && (
                          <AlertTriangle className="w-4 h-4 text-rose-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        )}
                      </div>

                      <button 
                        type="button"
                        onClick={() => handleRemoveValue(index)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all flex-shrink-0"
                        title="刪除此點"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <button 
                type="button"
                onClick={handleAddValue}
                className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-lg text-xs font-bold text-slate-400 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                新增量測點
              </button>
            </div>

            {/* Stats Preview */}
            <div className={cn(
              "p-4 rounded-xl border transition-all",
              isOutOfSpec ? "bg-rose-50 border-rose-100" : "bg-emerald-50 border-emerald-100"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className={cn("w-4 h-4", isOutOfSpec ? "text-rose-500" : "text-emerald-500")} />
                  <span className="text-sm font-bold text-slate-900">計算平均值</span>
                </div>
                <span className={cn(
                  "text-lg font-bold font-mono",
                  isOutOfSpec ? "text-rose-600" : "text-emerald-600"
                )}>
                  {numericValues.length > 0 ? mean.toFixed(3) : '-'} {testItem.unit}
                </span>
              </div>
              {isOutOfSpec && (
                <p className="text-[11px] font-bold text-rose-600 mt-2 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  警告：平均值超出規格範圍 ({specMin ?? '-'} ~ {specMax ?? '-'})
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer - Always Sticky at bottom */}
        <div className="flex-shrink-0 p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex gap-3 z-10">
          {showConfirm ? (
            <div className="flex-1 flex flex-col gap-3">
              <p className="text-xs font-bold text-rose-600 text-center">平均值超出規格，確定要儲存嗎？</p>
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  返回修改
                </button>
                <button 
                  type="button"
                  onClick={() => onSave(numericValues)}
                  className="flex-1 py-2 text-sm font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
                >
                  確認儲存
                </button>
              </div>
            </div>
          ) : (
            <>
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                取消返回
              </button>
              <button 
                type="button"
                onClick={() => {
                  if (numericValues.length > 0 && isOutOfSpec) {
                    setShowConfirm(true);
                  } else {
                    onSave(numericValues);
                  }
                }}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-200"
              >
                儲存結果 ({numericValues.length} 點)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

