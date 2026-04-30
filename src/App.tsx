import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ProjectList } from './components/ProjectList';
import { ExperimentList } from './components/ExperimentList';
import { ExperimentDetail } from './components/ExperimentDetail';
import { Analysis } from './components/Analysis';
import { AuthProvider, useAuth } from './components/AuthContext';
import { ComparisonProvider } from './components/ComparisonContext';
import { Login } from './components/Login';
import { UserManagement } from './components/UserManagement';
import { DataComparison } from './components/DataComparison';
import { MasterDataSettings } from './components/MasterDataSettings';
import { RDManagement } from './components/RDManagement';

const ProtectedRoute: React.FC<{ children: React.ReactNode; requireAdmin?: boolean }> = ({ children, requireAdmin }) => {
  const { user, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.isApproved && user.role !== 'Admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl text-center space-y-6">
          <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">帳號審核中</h2>
            <p className="text-slate-500">您的帳號已成功註冊，但需要管理員核准後才能進入系統。請聯繫管理員進行審核。</p>
            <p className="text-xs text-slate-400 mt-4 italic">系統將在管理員核准後自動跳轉，無需重新整理。</p>
          </div>
          <button 
            onClick={() => logout()}
            className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
          >
            登出並返回登入頁面
          </button>
        </div>
      </div>
    );
  }

  if (requireAdmin && user.role !== 'Admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<ProjectList />} />
        <Route path="experiments" element={<ExperimentList />} />
        <Route path="experiments/:id" element={<ExperimentDetail />} />
        <Route path="comparison" element={<DataComparison />} />
        <Route path="analysis" element={<Analysis />} />
        <Route path="users" element={<ProtectedRoute requireAdmin><UserManagement /></ProtectedRoute>} />
        <Route path="master-data" element={<ProtectedRoute><MasterDataSettings /></ProtectedRoute>} />
        <Route path="rd-center" element={<RDManagement />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ComparisonProvider>
        <HashRouter>
          <Toaster position="top-center" richColors />
          <AppRoutes />
        </HashRouter>
      </ComparisonProvider>
    </AuthProvider>
  );
}
