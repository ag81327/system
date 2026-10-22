import React, { useState, useEffect } from 'react';
import { X, Sliders, RotateCcw, Check, Sparkles } from 'lucide-react';
import { Sample, TestItem } from '../types';

interface SpecValue {
  min?: number;
  max?: number;
  target?: number;
}

interface SampleSpecModalProps {
  isOpen: boolean;
  sample: Sample | undefined;
  testItems: TestItem[];
  projectSpecs?: Record<string, { min?: number; max?: number; target?: number }>;
  onClose: () => void;
  onSave: (sampleId: string, specs: Record<string, SpecValue>) => Promise<void>;
}

export const SampleSpecModal: React.FC<SampleSpecModalProps> = ({
  isOpen,
  sample,
  testItems,
  projectSpecs = {},
  onClose,
  onSave
}) => {
  const [specs, setSpecs] = useState<Record<string, { min: string; max: string; target: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing sample specs or initialize
  useEffect(() => {
    if (sample && isOpen) {
      const initial: Record<string, { min: string; max: string; target: string }> = {};
      const sampleItemIds = (sample.results || []).map(r => r.testItemId);

      sampleItemIds.forEach(itemId => {
        const custom = sample.specs?.[itemId];
        initial[itemId] = {
          min: custom?.min !== undefined && custom?.min !== null ? custom.min.toString() : '',
          max: custom?.max !== undefined && custom?.max !== null ? custom.max.toString() : '',
          target: custom?.target !== undefined && custom?.target !== null ? custom.target.toString() : ''
        };
      });

      setSpecs(initial);
    }
  }, [sample, isOpen]);

  // Support ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !sample) return null;

  const sampleResults = sample.results || [];
  const relevantItems = sampleResults
    .map(r => testItems.find(t => t.id === r.testItemId))
    .filter((t): t is TestItem => !!t);

  const handleFieldChange = (itemId: string, field: 'min' | 'max' | 'target', val: string) => {
    setSpecs(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { min: '', max: '', target: '' }),
        [field]: val
      }
    }));
  };

  const handleResetItem = (itemId: string) => {
    setSpecs(prev => ({
      ...prev,
      [itemId]: { min: '', max: '', target: '' }
    }));
  };

  const handleResetAll = () => {
    const cleared: Record<string, { min: string; max: string; target: string }> = {};
    relevantItems.forEach(t => {
      cleared[t.id] = { min: '', max: '', target: '' };
    });
    setSpecs(cleared);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const cleanSpecs: Record<string, SpecValue> = {};
      Object.entries(specs).forEach(([itemId, val]) => {
        const minNum = val.min.trim() !== '' ? parseFloat(val.min) : undefined;
        const maxNum = val.max.trim() !== '' ? parseFloat(val.max) : undefined;
        const targetNum = val.target.trim() !== '' ? parseFloat(val.target) : undefined;

        if (
          (minNum !== undefined && !isNaN(minNum)) ||
          (maxNum !== undefined && !isNaN(maxNum)) ||
          (targetNum !== undefined && !isNaN(targetNum))
        ) {
          cleanSpecs[itemId] = {
            min: minNum !== undefined && !isNaN(minNum) ? minNum : undefined,
            max: maxNum !== undefined && !isNaN(maxNum) ? maxNum : undefined,
            target: targetNum !== undefined && !isNaN(targetNum) ? targetNum : undefined
          };
        }
      });

      await onSave(sample.id, cleanSpecs);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                樣品規格設定 <span className="text-brand-600">({sample.sampleCode})</span>
              </h3>
              <p className="text-xs text-slate-500">
                批次: {sample.batchNumber} | 可為此樣品自定義規格，留空將自動沿用專案規格
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action bar */}
        <div className="px-6 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            共 {relevantItems.length} 項測試項目
          </span>
          <button
            type="button"
            onClick={handleResetAll}
            className="text-xs text-slate-500 hover:text-rose-600 font-medium flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            全部恢復專案規格
          </button>
        </div>

        {/* Body list */}
        <form id="sample-spec-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
          {relevantItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              此樣品尚未選取任何測試項目。
            </div>
          ) : (
            relevantItems.map((item) => {
              const projSpec = projectSpecs[item.id];
              const defaultMin = projSpec?.min ?? item.specMin;
              const defaultMax = projSpec?.max ?? item.specMax;
              const defaultTarget = projSpec?.target ?? item.targetValue;
              const current = specs[item.id] || { min: '', max: '', target: '' };
              const hasCustom = current.min !== '' || current.max !== '' || current.target !== '';

              return (
                <div 
                  key={item.id} 
                  className="p-4 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-3 transition-colors hover:border-slate-300"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{item.name}</span>
                      {item.unit && (
                        <span className="text-xs text-slate-400 font-normal">({item.unit})</span>
                      )}
                      {hasCustom && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-brand-100 text-brand-700 font-bold rounded">
                          自定義
                        </span>
                      )}
                    </div>
                    {hasCustom && (
                      <button
                        type="button"
                        onClick={() => handleResetItem(item.id)}
                        className="text-[11px] text-slate-400 hover:text-rose-600 flex items-center gap-1 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        恢復專案規格
                      </button>
                    )}
                  </div>

                  {/* Project Spec Reference banner */}
                  <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-100 text-[11px] text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-semibold text-slate-600">專案規格參考:</span>
                    <span>下限 (LSL): <strong className="font-mono text-slate-700">{defaultMin ?? '-'}</strong></span>
                    <span>目標值: <strong className="font-mono text-brand-600">{defaultTarget ?? '-'}</strong></span>
                    <span>上限 (USL): <strong className="font-mono text-slate-700">{defaultMax ?? '-'}</strong></span>
                  </div>

                  {/* Custom Spec Inputs */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        樣品下限 (LSL)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={current.min}
                        onChange={(e) => handleFieldChange(item.id, 'min', e.target.value)}
                        placeholder={defaultMin !== undefined ? `預設: ${defaultMin}` : '未設定'}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        樣品目標值
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={current.target}
                        onChange={(e) => handleFieldChange(item.id, 'target', e.target.value)}
                        placeholder={defaultTarget !== undefined ? `預設: ${defaultTarget}` : '未設定'}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        樣品上限 (USL)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={current.max}
                        onChange={(e) => handleFieldChange(item.id, 'max', e.target.value)}
                        placeholder={defaultMax !== undefined ? `預設: ${defaultMax}` : '未設定'}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-200"
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </form>

        {/* Footer */}
        <div className="flex-shrink-0 p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            form="sample-spec-form"
            disabled={isSubmitting}
            className="px-5 py-2 text-sm font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-all shadow-md shadow-brand-200 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            {isSubmitting ? '儲存中...' : '儲存樣品規格'}
          </button>
        </div>
      </div>
    </div>
  );
};
