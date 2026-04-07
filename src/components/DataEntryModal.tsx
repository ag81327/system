import React, { useState } from 'react';
import { X, Plus, Trash2, Calculator } from 'lucide-react';
import { cn } from '../lib/utils';
import { TestItem } from '../types';

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

  if (!isOpen) return null;

  const handleAddValue = () => setValues([...values, '']);
  const handleRemoveValue = (index: number) => {
    if (values.length > 1) {
      setValues(values.filter((_, i) => i !== index));
    }
  };

  const handleValueChange = (index: number, val: string) => {
    const newValues = [...values];
    newValues[index] = val;
    setValues(newValues);
  };

  const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
  const mean = numericValues.length > 0 ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length : 0;
  
  const isOutOfSpec = (specMin !== undefined && mean < specMin) || 
                      (specMax !== undefined && mean > specMax);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">輸入測試數據</h3>
            <p className="text-xs text-slate-500">{testItem.name} ({testItem.unit})</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Spec Info */}
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">規格範圍</p>
              <p className="text-sm font-bold text-slate-900">
                {specMin ?? '-'} - {specMax ?? '-'} {testItem.unit}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">目標值</p>
              <p className="text-sm font-bold text-brand-600">{targetValue ?? '-'} {testItem.unit}</p>
            </div>
          </div>

          {/* Values List */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">量測數值</label>
            {values.map((val, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">
                  {index + 1}
                </div>
                <input 
                  type="number" 
                  value={val}
                  onChange={(e) => handleValueChange(index, e.target.value)}
                  placeholder="0.00"
                  className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all"
                />
                <button 
                  onClick={() => handleRemoveValue(index)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button 
              onClick={handleAddValue}
              className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-xs font-bold text-slate-400 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50 transition-all flex items-center justify-center gap-2"
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
                "text-lg font-bold",
                isOutOfSpec ? "text-rose-600" : "text-emerald-600"
              )}>
                {mean.toFixed(2)} {testItem.unit}
              </span>
            </div>
            {isOutOfSpec && (
              <p className="text-[10px] font-bold text-rose-500 mt-2 uppercase tracking-wider">
                警告：結果超出規格範圍
              </p>
            )}
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button 
            onClick={() => onSave(numericValues)}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-200"
          >
            儲存結果
          </button>
        </div>
      </div>
    </div>
  );
};
