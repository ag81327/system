import React, { useState, useEffect } from 'react';
import { 
  Database, 
  FlaskConical, 
  Beaker, 
  Settings2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Edit3, 
  Search,
  Save,
  X,
  ChevronRight,
  Package,
  Thermometer,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { 
  TestItem, 
  MaterialMaster, 
  ProcessParameterMaster, 
  DefectMaster,
  ProcessConditionType
} from '../types';
import { 
  getPersistentTestItems, 
  savePersistentTestItems, 
  deletePersistentTestItem,
  getPersistentMaterials,
  savePersistentMaterial,
  deletePersistentMaterial,
  getPersistentProcessParameters,
  savePersistentProcessParameter,
  deletePersistentProcessParameter,
  getPersistentDefectMasters,
  savePersistentDefectMaster,
  deletePersistentDefectMaster
} from '../lib/persistence';

type TabType = 'materials' | 'process-params' | 'defects' | 'test-items';

export const MasterDataSettings = () => {
  const [activeTab, setActiveTab] = useState<TabType>('materials');
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Data States
  const [testItems, setTestItems] = useState<TestItem[]>([]);
  const [materials, setMaterials] = useState<MaterialMaster[]>([]);
  const [processParams, setProcessParams] = useState<ProcessParameterMaster[]>([]);
  const [defects, setDefects] = useState<DefectMaster[]>([]);

  // Edit States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [items, mats, params, defs] = await Promise.all([
        getPersistentTestItems(),
        getPersistentMaterials(),
        getPersistentProcessParameters(),
        getPersistentDefectMasters()
      ]);
      setTestItems(items);
      setMaterials(mats);
      setProcessParams(params);
      setDefects(defs);
    } catch (error) {
      console.error('Error fetching master data:', error);
      toast.error('讀取基礎資料失敗');
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'materials', label: '原物料清單', icon: Package },
    { id: 'process-params', label: '製程參數種類', icon: Thermometer },
    { id: 'defects', label: '缺陷與等級定義', icon: ShieldAlert },
    { id: 'test-items', label: '測試項目管理', icon: FlaskConical },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Database className="w-8 h-8 text-brand-600" />
            基礎資料設定
          </h1>
          <p className="text-slate-500 mt-1">管理系統全域主資料，確保數據標準化與一致性。</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="搜尋資料..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all w-64 shadow-sm"
            />
          </div>
          <button 
            onClick={() => {
              setEditingId(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 transition-all flex items-center gap-2 shadow-lg shadow-brand-200"
          >
            <Plus className="w-4 h-4" />
            新增資料
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
              activeTab === tab.id 
                ? "bg-white text-brand-600 shadow-sm" 
                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
            )}
          >
            <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-brand-600" : "text-slate-400")} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-[400px]">
            <div className="w-10 h-10 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="p-6">
            {activeTab === 'materials' && (
              <MaterialsTable 
                items={materials.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))} 
                onEdit={(id) => { setEditingId(id); setIsModalOpen(true); }}
                onDelete={async (id) => {
                  toast('確定要刪除此原物料嗎？', {
                    action: {
                      label: '確定刪除',
                      onClick: async () => {
                        await deletePersistentMaterial(id);
                        fetchData();
                        toast.success('已刪除原物料');
                      }
                    }
                  });
                }}
              />
            )}
            {activeTab === 'process-params' && (
              <ProcessParamsTable 
                items={processParams.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))} 
                onEdit={(id) => { setEditingId(id); setIsModalOpen(true); }}
                onDelete={async (id) => {
                  toast('確定要刪除此製程參數嗎？', {
                    action: {
                      label: '確定刪除',
                      onClick: async () => {
                        await deletePersistentProcessParameter(id);
                        fetchData();
                        toast.success('已刪除製程參數');
                      }
                    }
                  });
                }}
              />
            )}
            {activeTab === 'defects' && (
              <DefectsTable 
                items={defects.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))} 
                onEdit={(id) => { setEditingId(id); setIsModalOpen(true); }}
                onDelete={async (id) => {
                  toast('確定要刪除此缺陷定義嗎？', {
                    action: {
                      label: '確定刪除',
                      onClick: async () => {
                        await deletePersistentDefectMaster(id);
                        fetchData();
                        toast.success('已刪除缺陷定義');
                      }
                    }
                  });
                }}
              />
            )}
            {activeTab === 'test-items' && (
              <TestItemsTable 
                items={testItems.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))} 
                onEdit={(id) => { setEditingId(id); setIsModalOpen(true); }}
                onDelete={async (id) => {
                  toast('確定要刪除此測試項目嗎？', {
                    action: {
                      label: '確定刪除',
                      onClick: async () => {
                        await deletePersistentTestItem(id);
                        fetchData();
                        toast.success('已刪除測試項目');
                      }
                    }
                  });
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {isModalOpen && (
        <MasterDataModal 
          type={activeTab}
          editingId={editingId}
          onClose={() => setIsModalOpen(false)}
          onSave={async (data) => {
            try {
              if (activeTab === 'materials') {
                await savePersistentMaterial({ ...data, id: editingId || `mat${Date.now()}` });
              } else if (activeTab === 'process-params') {
                await savePersistentProcessParameter({ ...data, id: editingId || `pp${Date.now()}` });
              } else if (activeTab === 'defects') {
                await savePersistentDefectMaster({ ...data, id: editingId || `def${Date.now()}` });
              } else if (activeTab === 'test-items') {
                await savePersistentTestItems([{ ...data, id: editingId || `ti${Date.now()}` }]);
              }
              fetchData();
              setIsModalOpen(false);
              toast.success('資料已儲存');
            } catch (error) {
              console.error('Error saving master data:', error);
              toast.error('儲存失敗');
            }
          }}
          initialData={
            activeTab === 'materials' ? materials.find(i => i.id === editingId) :
            activeTab === 'process-params' ? processParams.find(i => i.id === editingId) :
            activeTab === 'defects' ? defects.find(i => i.id === editingId) :
            testItems.find(i => i.id === editingId)
          }
        />
      )}
    </div>
  );
};

// --- Sub-components (Tables) ---

const TestItemsTable = ({ items, onEdit, onDelete }: { items: TestItem[], onEdit: (id: string) => void, onDelete: (id: string) => void }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-b border-slate-100">
          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">項目名稱</th>
          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">單位</th>
          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">預設規格 (Min/Target/Max)</th>
          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">操作</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {items.map(item => (
          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
            <td className="px-4 py-4">
              <span className="text-sm font-bold text-slate-700">{item.name}</span>
            </td>
            <td className="px-4 py-4">
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">{item.unit || '無'}</span>
            </td>
            <td className="px-4 py-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{item.specMin ?? '-'}</span> / 
                <span className="text-brand-600 font-bold">{item.targetValue ?? '-'}</span> / 
                <span>{item.specMax ?? '-'}</span>
              </div>
            </td>
            <td className="px-4 py-4 text-right">
              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={() => onEdit(item.id)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(item.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
        {items.length === 0 && (
          <tr>
            <td colSpan={4} className="px-4 py-12 text-center text-slate-400 italic text-sm">尚未建立任何測試項目</td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

const MaterialsTable = ({ items, onEdit, onDelete }: { items: MaterialMaster[], onEdit: (id: string) => void, onDelete: (id: string) => void }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-b border-slate-100">
          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">材料名稱</th>
          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">供應商 / 型號</th>
          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">單位</th>
          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">安全庫存</th>
          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">操作</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {items.map(item => (
          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
            <td className="px-4 py-4">
              <span className="text-sm font-bold text-slate-700">{item.name}</span>
            </td>
            <td className="px-4 py-4">
              <div className="flex flex-col">
                <span className="text-xs text-slate-600">{item.supplier || '-'}</span>
                <span className="text-[10px] text-slate-400">{item.specModel || '-'}</span>
              </div>
            </td>
            <td className="px-4 py-4">
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">{item.unit}</span>
            </td>
            <td className="px-4 py-4">
              <span className="text-xs text-slate-600">{item.safetyStock ?? '-'}</span>
            </td>
            <td className="px-4 py-4 text-right">
              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={() => onEdit(item.id)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(item.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
        {items.length === 0 && (
          <tr>
            <td colSpan={5} className="px-4 py-12 text-center text-slate-400 italic text-sm">尚未建立任何原物料</td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

const ProcessParamsTable = ({ items, onEdit, onDelete }: { items: ProcessParameterMaster[], onEdit: (id: string) => void, onDelete: (id: string) => void }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-b border-slate-100">
          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">參數名稱</th>
          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">類別</th>
          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">單位</th>
          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">關聯設備</th>
          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">操作</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {items.map(item => (
          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
            <td className="px-4 py-4">
              <span className="text-sm font-bold text-slate-700">{item.name}</span>
            </td>
            <td className="px-4 py-4">
              <span className="px-2 py-0.5 bg-brand-50 text-brand-600 rounded-full text-[10px] font-bold border border-brand-100">
                {item.category}
              </span>
            </td>
            <td className="px-4 py-4">
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">{item.unit}</span>
            </td>
            <td className="px-4 py-4">
              <span className="text-xs text-slate-600">{item.equipment || '-'}</span>
            </td>
            <td className="px-4 py-4 text-right">
              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={() => onEdit(item.id)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(item.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
        {items.length === 0 && (
          <tr>
            <td colSpan={5} className="px-4 py-12 text-center text-slate-400 italic text-sm">尚未建立任何製程參數</td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

const DefectsTable = ({ items, onEdit, onDelete }: { items: DefectMaster[], onEdit: (id: string) => void, onDelete: (id: string) => void }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-b border-slate-100">
          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">代碼 / 名稱</th>
          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">嚴重程度</th>
          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">描述</th>
          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">操作</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {items.map(item => (
          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
            <td className="px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{item.code}</span>
                <span className="text-sm font-bold text-slate-700">{item.name}</span>
              </div>
            </td>
            <td className="px-4 py-4">
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                item.severity === 'Critical' ? "bg-rose-50 text-rose-600 border-rose-100" :
                item.severity === 'Major' ? "bg-amber-50 text-amber-600 border-amber-100" :
                "bg-blue-50 text-blue-600 border-blue-100"
              )}>
                {item.severity}
              </span>
            </td>
            <td className="px-4 py-4">
              <p className="text-xs text-slate-500 truncate max-w-xs">{item.description || '-'}</p>
            </td>
            <td className="px-4 py-4 text-right">
              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={() => onEdit(item.id)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(item.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
        {items.length === 0 && (
          <tr>
            <td colSpan={4} className="px-4 py-12 text-center text-slate-400 italic text-sm">尚未建立任何缺陷定義</td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

// --- Modal Component ---

const MasterDataModal = ({ type, editingId, onClose, onSave, initialData }: { 
  type: TabType, 
  editingId: string | null, 
  onClose: () => void, 
  onSave: (data: any) => Promise<void>,
  initialData?: any
}) => {
  const [formData, setFormData] = useState<any>(initialData || {});

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      // Set defaults for new items
      if (type === 'process-params') {
        setFormData({ category: 'Other', unit: '' });
      } else if (type === 'materials') {
        setFormData({ unit: 'g' });
      } else if (type === 'defects') {
        setFormData({ severity: 'Minor' });
      } else {
        setFormData({});
      }
    }
  }, [initialData, type]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-900">
            {editingId ? '編輯' : '新增'} {
              type === 'materials' ? '原物料' :
              type === 'process-params' ? '製程參數' :
              type === 'defects' ? '缺陷定義' :
              '測試項目'
            }
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {type === 'materials' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1">材料名稱</label>
                <input 
                  required
                  type="text" 
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">供應商</label>
                  <input 
                    type="text" 
                    value={formData.supplier || ''}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">規格型號</label>
                  <input 
                    type="text" 
                    value={formData.specModel || ''}
                    onChange={(e) => setFormData({ ...formData, specModel: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">單位</label>
                  <input 
                    required
                    type="text" 
                    value={formData.unit || ''}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">安全庫存</label>
                  <input 
                    type="number" 
                    value={formData.safetyStock ?? ''}
                    onChange={(e) => setFormData({ ...formData, safetyStock: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  />
                </div>
              </div>
            </>
          )}

          {type === 'process-params' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1">參數名稱</label>
                <input 
                  required
                  type="text" 
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">類別</label>
                  <select 
                    required
                    value={formData.category || 'Other'}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as ProcessConditionType })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  >
                    <option value="Temperature">溫度</option>
                    <option value="Pressure">壓力</option>
                    <option value="Time">時間</option>
                    <option value="Energy">能量</option>
                    <option value="Concentration">濃度</option>
                    <option value="Other">其他</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">單位</label>
                  <input 
                    required
                    type="text" 
                    value={formData.unit || ''}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1">關聯設備</label>
                <input 
                  type="text" 
                  value={formData.equipment || ''}
                  onChange={(e) => setFormData({ ...formData, equipment: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                />
              </div>
            </>
          )}

          {type === 'defects' && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">代碼</label>
                  <input 
                    required
                    type="text" 
                    placeholder="D001"
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">缺陷名稱</label>
                  <input 
                    required
                    type="text" 
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1">嚴重程度</label>
                <select 
                  required
                  value={formData.severity || 'Minor'}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                >
                  <option value="Minor">輕微 (Minor)</option>
                  <option value="Major">主要 (Major)</option>
                  <option value="Critical">嚴重 (Critical)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1">描述</label>
                <textarea 
                  rows={3}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all resize-none"
                />
              </div>
            </>
          )}

          {type === 'test-items' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1">項目名稱</label>
                <input 
                  required
                  type="text" 
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1">單位</label>
                <input 
                  required
                  type="text" 
                  value={formData.unit || ''}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">最小值 (Min)</label>
                  <input 
                    type="number" 
                    step="any"
                    value={formData.specMin ?? ''}
                    onChange={(e) => setFormData({ ...formData, specMin: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">目標值 (Target)</label>
                  <input 
                    type="number" 
                    step="any"
                    value={formData.targetValue ?? ''}
                    onChange={(e) => setFormData({ ...formData, targetValue: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">最大值 (Max)</label>
                  <input 
                    type="number" 
                    step="any"
                    value={formData.specMax ?? ''}
                    onChange={(e) => setFormData({ ...formData, specMax: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  />
                </div>
              </div>
            </>
          )}

          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-200 transition-all"
            >
              取消
            </button>
            <button 
              type="submit"
              className="flex-1 py-3 bg-brand-600 text-white rounded-2xl text-sm font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-200 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              儲存資料
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
