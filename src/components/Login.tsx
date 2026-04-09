import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { Beaker, LogIn, Lock, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const { login, register, loginWithGoogle, resetPassword } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('請輸入電子郵件');
      return;
    }
    setIsSubmitting(true);
    const result = await resetPassword(email);
    if (result.success) {
      toast.success('密碼重設郵件已發送', { description: '請檢查您的收件匣。' });
      setIsForgotPassword(false);
    } else {
      toast.error(result.error || '發送失敗');
    }
    setIsSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    if (isRegistering) {
      const result = await register(email, password, name);
      if (result.success) {
        toast.success('註冊並登入成功');
      } else {
        const isAlreadyInUse = result.error?.includes('已被註冊');
        toast.error(result.error || '註冊失敗', {
          description: isAlreadyInUse ? '如果您之前曾刪除過帳號，請嘗試直接登入以重新啟用。' : undefined,
          action: isAlreadyInUse ? {
            label: '前往登入',
            onClick: () => setIsRegistering(false)
          } : undefined
        });
      }
    } else {
      const result = await login(email, password);
      if (result.success) {
        toast.success('登入成功');
      } else {
        toast.error(result.error || '登入失敗，請檢查帳號或密碼');
      }
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 text-white mb-4 shadow-xl shadow-brand-200">
            <Beaker className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">摩爾應材研發數據管理平台</h1>
          <p className="text-slate-500 mt-2">請登入以存取您的數據紀錄</p>
        </div>

        <div className="glass-panel p-8 rounded-3xl shadow-xl">
          {isForgotPassword ? (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-slate-700 mb-2">
                  電子郵件 (帳號)
                </label>
                <div className="relative">
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="請輸入您的電子郵件"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all pl-11"
                    required
                  />
                  <LogIn className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? '處理中...' : '發送重設郵件'}
              </button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="text-sm text-slate-500 font-medium hover:underline"
                >
                  返回登入
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {isRegistering && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
                  姓名
                </label>
                <div className="relative">
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="請輸入您的姓名"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all pl-11"
                    required
                  />
                  <UserIcon className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                電子郵件 (帳號)
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="請輸入您的電子郵件"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all pl-11"
                  required
                />
                <LogIn className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                密碼
              </label>
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="請輸入您的密碼"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all pl-11"
                  required
                />
                <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {!isRegistering && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(true)}
                  className="text-xs text-brand-600 font-medium hover:underline"
                >
                  忘記密碼？
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? '處理中...' : (isRegistering ? '立即註冊' : '登入系統')}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-sm text-brand-600 font-medium hover:underline"
              >
                {isRegistering ? '已有帳號？返回登入' : '還沒有帳號？點此註冊'}
              </button>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">或者</span>
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                setIsSubmitting(true);
                const result = await loginWithGoogle();
                if (result.success) {
                  toast.success('Google 登入成功');
                } else {
                  toast.error(result.error || 'Google 登入失敗');
                }
                setIsSubmitting(false);
              }}
              disabled={isSubmitting}
              className="w-full py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              使用 Google 帳戶登入
            </button>
          </form>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              若忘記密碼，請聯繫系統管理員進行重設。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
