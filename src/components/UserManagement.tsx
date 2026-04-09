import React, { useState, useEffect } from 'react';
import { User, Project, UserPermission, UserRole } from '../types';
import { 
  getPersistentUsers, 
  getPersistentProjects, 
  getPersistentPermissions, 
  savePersistentPermissions,
  savePersistentUsers,
  deletePersistentUser
} from '../lib/persistence';
import { Shield, User as UserIcon, Check, X, Search, Key, Save, Plus, Mail, UserPlus, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { motion, AnimatePresence } from 'motion/react';

export const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit states
  const [editingName, setEditingName] = useState('');
  const [editingEmail, setEditingEmail] = useState('');
  const [editingRole, setEditingRole] = useState<UserRole>('User');
  const [editingIsApproved, setEditingIsApproved] = useState(false);
  const [editingAccessStartDate, setEditingAccessStartDate] = useState('');
  const [editingAccessEndDate, setEditingAccessEndDate] = useState('');
  const [editingRelativeAccessDays, setEditingRelativeAccessDays] = useState<number | null>(null);
  const [editingProjectAccessLimits, setEditingProjectAccessLimits] = useState<Record<string, { startDate?: string, endDate?: string, relativeAccessDays?: number | null }>>({});

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [usersData, projectsData, permissionsData] = await Promise.all([
          getPersistentUsers(),
          getPersistentProjects(),
          getPersistentPermissions()
        ]);
        setUsers(usersData);
        setProjects(projectsData);
        setPermissions(permissionsData);
      } catch (error) {
        console.error('Error fetching user management data:', error);
        toast.error('讀取數據失敗');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Add User Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'User' as UserRole
  });

  const selectedUser = users.find(u => u.id === selectedUserId);
  const userPermissions = permissions.find(p => p.userId === selectedUserId);

  useEffect(() => {
    if (selectedUser) {
      setEditingName(selectedUser.name);
      setEditingEmail(selectedUser.email);
      setEditingRole(selectedUser.role);
      setEditingIsApproved(selectedUser.isApproved);
      setEditingAccessStartDate(selectedUser.accessStartDate || '');
      setEditingAccessEndDate(selectedUser.accessEndDate || '');
      setEditingRelativeAccessDays(selectedUser.relativeAccessDays || null);
      setEditingProjectAccessLimits(userPermissions?.projectAccessLimits || {});
    }
  }, [selectedUserId, selectedUser, userPermissions]);

  const handleTogglePermission = async (projectId: string) => {
    if (!selectedUserId) return;

    const newPermissions = [...permissions];
    const userIndex = newPermissions.findIndex(p => p.userId === selectedUserId);

    if (userIndex > -1) {
      const projectIds = [...newPermissions[userIndex].projectIds];
      const projectIndex = projectIds.indexOf(projectId);

      if (projectIndex > -1) {
        projectIds.splice(projectIndex, 1);
      } else {
        projectIds.push(projectId);
      }
      newPermissions[userIndex] = { ...newPermissions[userIndex], projectIds };
    } else {
      newPermissions.push({ userId: selectedUserId, projectIds: [projectId] });
    }

    try {
      await savePersistentPermissions(newPermissions);
      setPermissions(newPermissions);
      toast.success('權限已更新');
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast.error('更新權限失敗');
    }
  };

  const handleUpdateProjectLimit = async (projectId: string, field: 'startDate' | 'endDate' | 'relativeAccessDays', value: any) => {
    if (!selectedUserId) return;

    const newLimits = { ...editingProjectAccessLimits };
    if (!newLimits[projectId]) newLimits[projectId] = {};
    
    if (field === 'relativeAccessDays') {
      newLimits[projectId][field] = value === 'none' ? null : Number(value);
    } else {
      newLimits[projectId][field] = value;
    }
    
    setEditingProjectAccessLimits(newLimits);

    const newPermissions = [...permissions];
    const userIndex = newPermissions.findIndex(p => p.userId === selectedUserId);
    if (userIndex > -1) {
      newPermissions[userIndex] = { ...newPermissions[userIndex], projectAccessLimits: newLimits };
    } else {
      newPermissions.push({ userId: selectedUserId, projectIds: [], projectAccessLimits: newLimits });
    }

    try {
      await savePersistentPermissions(newPermissions);
      setPermissions(newPermissions);
    } catch (error) {
      console.error('Error updating project limits:', error);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUserId) return;
    if (!editingName || !editingEmail) {
      toast.error('請填寫所有必要欄位');
      return;
    }

    const updatedUsers = users.map(u => 
      u.id === selectedUserId ? { 
        ...u, 
        name: editingName, 
        email: editingEmail, 
        role: editingRole,
        isApproved: editingIsApproved,
        accessStartDate: editingAccessStartDate || null,
        accessEndDate: editingAccessEndDate || null,
        relativeAccessDays: editingRelativeAccessDays
      } : u
    );

    try {
      await savePersistentUsers(updatedUsers);
      setUsers(updatedUsers);
      toast.success('帳號資訊已更新');
    } catch (error) {
      console.error('Error updating users:', error);
      toast.error('更新帳號失敗');
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email) {
      toast.error('請填寫所有必要欄位');
      return;
    }

    if (users.some(u => u.email === newUser.email)) {
      toast.error('此電子郵件已被使用');
      return;
    }

    const newUserId = `u${Date.now()}`;
    const userToAdd: User = {
      id: newUserId,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      isApproved: true // Manually added users are auto-approved
    };

    const updatedUsers = [...users, userToAdd];
    const newPermissions = [...permissions, { userId: newUserId, projectIds: [] }];

    try {
      await Promise.all([
        savePersistentUsers(updatedUsers),
        savePersistentPermissions(newPermissions)
      ]);
      
      setUsers(updatedUsers);
      setPermissions(newPermissions);

      setIsAddModalOpen(false);
      setNewUser({ name: '', email: '', password: '', role: 'User' });
      setSelectedUserId(newUserId);
      toast.success('人員紀錄已新增。請告知該人員使用此 Email 自行註冊以設定密碼。');
    } catch (error) {
      console.error('Error adding user:', error);
      toast.error('新增人員失敗');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUserId) return;
    if (selectedUserId === currentUser?.id) {
      toast.error('您不能刪除自己的帳號');
      return;
    }

    setIsDeleteModalOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!selectedUserId) return;

    try {
      await deletePersistentUser(selectedUserId);
      setUsers(users.filter(u => u.id !== selectedUserId));
      setPermissions(permissions.filter(p => p.userId !== selectedUserId));
      setSelectedUserId(null);
      setIsDeleteModalOpen(false);
      toast.success('人員已刪除');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('刪除人員失敗');
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">人員權限管理</h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">管理系統人員帳號、密碼與專案存取權限</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-200"
        >
          <Plus className="w-5 h-5" />
          新增人員
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* User List */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col h-[600px]">
          <div className="relative mb-6">
            <input
              type="text"
              placeholder="搜尋人員..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {filteredUsers.map(user => (
              <button
                key={user.id}
                onClick={() => setSelectedUserId(user.id)}
                className={`w-full p-4 rounded-xl flex items-center gap-4 transition-all ${
                  selectedUserId === user.id 
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-200' 
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  selectedUserId === user.id ? 'bg-white/20' : 'bg-slate-100'
                }`}>
                  {user.role === 'Admin' ? <Shield className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
                </div>
                <div className="text-left min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold truncate">{user.name}</p>
                    {!user.isApproved && (
                      <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 text-[10px] font-bold rounded uppercase">待審核</span>
                    )}
                  </div>
                  <p className={`text-xs truncate ${selectedUserId === user.id ? 'text-white/70' : 'text-slate-500'}`}>
                    {user.email}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Permissions Panel */}
        <div className="lg:col-span-2 glass-panel p-8 rounded-2xl min-h-[600px] overflow-y-auto">
          {selectedUser ? (
            <div className="space-y-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">帳號設定</h2>
                  <p className="text-sm text-slate-500 mt-1">管理 {selectedUser.name} 的基本資訊與密碼</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                  selectedUser.role === 'Admin' ? 'bg-amber-100 text-amber-700' : 'bg-brand-100 text-brand-700'
                }`}>
                  {selectedUser.role === 'Admin' ? '管理員' : '一般帳號'}
                </div>
              </div>

              {/* Account Management */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">姓名</label>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">電子郵件 (帳號)</label>
                    <input
                      type="email"
                      value={editingEmail}
                      readOnly
                      className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl outline-none text-slate-500 cursor-not-allowed"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">帳號電子郵件不可修改</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">角色權限</label>
                    <select
                      value={editingRole}
                      onChange={(e) => setEditingRole(e.target.value as UserRole)}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="User">一般帳號</option>
                      <option value="Admin">管理員</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">審核狀態</label>
                    <div className="flex items-center gap-4 h-[42px]">
                      <button
                        onClick={() => setEditingIsApproved(true)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border-2 transition-all font-bold text-sm ${
                          editingIsApproved 
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                            : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                        已核准
                      </button>
                      <button
                        onClick={() => setEditingIsApproved(false)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border-2 transition-all font-bold text-sm ${
                          !editingIsApproved 
                            ? 'border-rose-500 bg-rose-50 text-rose-700' 
                            : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                        }`}
                      >
                        <X className="w-4 h-4" />
                        待審核
                      </button>
                    </div>
                  </div>
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-brand-50/50 rounded-2xl border border-brand-100">
                      <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-brand-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <Key className="w-3 h-3" />
                          實驗紀錄存取期限 (選填)
                        </label>
                        <p className="text-[10px] text-brand-600 mb-3">設定該人員可查看實驗紀錄的時間範圍。若不設定則無限制。</p>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">相對期限 (最近天數)</label>
                        <select
                          value={editingRelativeAccessDays || 'none'}
                          onChange={(e) => setEditingRelativeAccessDays(e.target.value === 'none' ? null : Number(e.target.value))}
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                        >
                          <option value="none">無相對限制</option>
                          <option value="30">最近 30 天</option>
                          <option value="60">最近 60 天</option>
                          <option value="180">最近 180 天</option>
                          <option value="365">最近 1 年</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">開始日期</label>
                        <input
                          type="date"
                          value={editingAccessStartDate}
                          onChange={(e) => setEditingAccessStartDate(e.target.value)}
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">結束日期</label>
                        <input
                          type="date"
                          value={editingAccessEndDate}
                          onChange={(e) => setEditingAccessEndDate(e.target.value)}
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                        />
                      </div>
                    </div>
                </div>
                
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-xs text-amber-700 flex items-start gap-2">
                    <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      <strong>安全提示：</strong> 密碼由 Firebase Authentication 系統加密管理。
                      若人員忘記密碼，請引導其使用註冊頁面的功能重新設定，或由管理員在 Firebase 控制台重設。
                    </span>
                  </p>
                </div>
                
                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={handleDeleteUser}
                    disabled={selectedUserId === currentUser?.id}
                    className="px-6 py-2 text-red-600 border border-red-200 rounded-xl font-bold hover:bg-red-50 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    刪除人員
                  </button>
                  <button
                    onClick={handleUpdateUser}
                    className="px-6 py-2 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all flex items-center gap-2 shadow-lg shadow-brand-100"
                  >
                    <Save className="w-4 h-4" />
                    儲存帳號修改
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-8">
                <h2 className="text-xl font-bold text-slate-900 mb-4">專案存取權限</h2>
                {selectedUser.role === 'Admin' ? (
                  <div className="p-12 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">管理員擁有最高權限，預設可存取所有專案內容。</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {projects.map(project => {
                      const isAllowed = userPermissions?.projectIds.includes(project.id);
                      const limits = editingProjectAccessLimits[project.id] || {};
                      return (
                        <div
                          key={project.id}
                          className={`p-6 rounded-2xl border-2 transition-all text-left space-y-4 ${
                            isAllowed 
                              ? 'border-brand-500 bg-brand-50/30' 
                              : 'border-slate-100 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <p className={`font-bold truncate ${isAllowed ? 'text-brand-700' : 'text-slate-900'}`}>
                                {project.name}
                              </p>
                              <p className="text-xs text-slate-500 mt-1 truncate">{project.description}</p>
                            </div>
                            <button
                              onClick={() => handleTogglePermission(project.id)}
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                isAllowed 
                                  ? 'bg-brand-500 text-white' 
                                  : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                              }`}
                            >
                              {isAllowed ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            </button>
                          </div>
                          
                          {isAllowed && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-brand-100">
                              <div>
                                <label className="block text-[10px] font-bold text-brand-600 uppercase mb-1">相對期限</label>
                                <select
                                  value={limits.relativeAccessDays || 'none'}
                                  onChange={(e) => handleUpdateProjectLimit(project.id, 'relativeAccessDays', e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-brand-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 text-xs"
                                >
                                  <option value="none">無相對限制</option>
                                  <option value="30">最近 30 天</option>
                                  <option value="60">最近 60 天</option>
                                  <option value="180">最近 180 天</option>
                                  <option value="365">最近 1 年</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-brand-600 uppercase mb-1">開始日期</label>
                                <input
                                  type="date"
                                  value={limits.startDate || ''}
                                  onChange={(e) => handleUpdateProjectLimit(project.id, 'startDate', e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-brand-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-brand-600 uppercase mb-1">結束日期</label>
                                <input
                                  type="date"
                                  value={limits.endDate || ''}
                                  onChange={(e) => handleUpdateProjectLimit(project.id, 'endDate', e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-brand-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 text-xs"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <UserIcon className="w-16 h-16 mb-4 opacity-20" />
              <p className="font-medium">請從左側選擇一位人員以管理帳號與權限</p>
            </div>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-100 text-brand-600 rounded-xl flex items-center justify-center">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">新增人員帳號</h3>
                </div>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleAddUser} className="p-6 space-y-4">
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 mb-4">
                  <p className="text-xs text-blue-700">
                    <strong>提示：</strong> 在此新增人員僅會建立資料庫紀錄與權限。
                    新增後，請告知該人員使用此 Email 在登入頁面點擊「註冊」來設定其專屬密碼。
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">姓名</label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    placeholder="例如：王小明"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">電子郵件 (帳號)</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      placeholder="example@mmatcorp.com"
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                      required
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">角色權限</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="User">一般帳號</option>
                    <option value="Admin">管理員</option>
                  </select>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-lg shadow-brand-200 transition-all"
                  >
                    確認新增
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">確定要刪除人員嗎？</h3>
                <div className="text-slate-500 mb-8 space-y-4">
                  <p>
                    您確定要刪除人員「<span className="font-bold text-slate-700">{selectedUser?.name}</span>」嗎？
                  </p>
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-left">
                    <p className="text-xs text-amber-700 font-bold mb-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> 重要提醒：
                    </p>
                    <p className="text-[11px] text-amber-600 leading-relaxed">
                      此操作僅會刪除資料庫紀錄。該人員的登入帳號仍會保留在系統中。
                      若要徹底刪除並允許重新註冊，請聯繫系統管理員在 Firebase 控制台手動刪除該帳號。
                      否則，該人員未來僅能透過「登入」來重新啟用帳號。
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="flex-1 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                  >
                    取消
                  </button>
                  <button
                    onClick={confirmDeleteUser}
                    className="flex-1 py-3 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-lg shadow-red-200 transition-all"
                  >
                    確認刪除
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
