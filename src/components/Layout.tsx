import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  LayoutDashboard, 
  Beaker, 
  ClipboardList, 
  BarChart3, 
  Settings, 
  Database,
  Search,
  Bell,
  User as UserIcon,
  LogOut,
  ShieldCheck,
  Key,
  X,
  Menu
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from './AuthContext';
import { NotificationCenter } from './NotificationCenter';

const SidebarItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) => cn(
      "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all rounded-lg group",
      isActive 
        ? "bg-brand-600 text-white shadow-lg shadow-brand-200" 
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    )}
  >
    <Icon className={cn("w-5 h-5 transition-colors", "group-hover:scale-110")} />
    <span>{label}</span>
  </NavLink>
);

const ChangePasswordModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { updatePassword } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('密碼不一致');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('密碼長度至少需 6 個字元');
      return;
    }
    const success = await updatePassword(newPassword);
    if (success) {
      toast.success('密碼修改成功');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">修改登入密碼</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">新密碼</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">確認新密碼</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
              required
            />
          </div>
          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 py-2 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-lg shadow-brand-200 transition-all"
            >
              儲存修改
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
    toast.info('已登出系統');
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 transition-transform duration-300 lg:translate-x-0 lg:static lg:inset-auto",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center justify-between lg:justify-start gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-200">
              <Database className="text-white w-6 h-6" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800">研發數據平台</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 lg:hidden text-slate-400 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto py-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mb-2">主要功能</div>
          <SidebarItem to="/" icon={LayoutDashboard} label="儀表板" />
          <SidebarItem to="/projects" icon={ClipboardList} label="專案管理" />
          <SidebarItem to="/experiments" icon={Beaker} label="實驗紀錄" />
          
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mt-8 mb-2">數據分析</div>
          <SidebarItem to="/analysis" icon={BarChart3} label="趨勢分析" />
          
          {user?.role === 'Admin' && (
            <>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mt-8 mb-2">系統管理</div>
              <SidebarItem to="/users" icon={ShieldCheck} label="人員權限管理" />
            </>
          )}
          <SidebarItem to="/master-data" icon={Settings} label="基礎資料設定" />
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs">
              {user?.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.role === 'Admin' ? '管理員' : '一般帳號'}</p>
            </div>
            <div className="flex gap-1">
              <button 
                onClick={() => setIsPasswordModalOpen(true)}
                className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-all"
                title="修改密碼"
              >
                <Key className="w-4 h-4" />
              </button>
              <button 
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all"
                title="登出"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <button 
              onClick={toggleSidebar}
              className="p-2 lg:hidden text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="relative w-full hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="搜尋專案、實驗、數據..." 
                onKeyDown={(e) => e.key === 'Enter' && toast.info(`正在搜尋: ${e.currentTarget.value}`)}
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-50 rounded-lg text-sm transition-all outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            <NotificationCenter />
            <div className="h-6 w-px bg-slate-200 mx-1 lg:mx-2"></div>
            <button 
              onClick={() => toast.info('個人檔案功能開發中')}
              className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
            >
              <UserIcon className="w-5 h-5" />
              <span className="hidden sm:inline">個人檔案</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </div>
      </main>

      <ChangePasswordModal 
        isOpen={isPasswordModalOpen} 
        onClose={() => setIsPasswordModalOpen(false)} 
      />
    </div>
  );
};
