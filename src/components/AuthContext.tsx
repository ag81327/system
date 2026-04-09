import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserPermission, AppNotification } from '../types';
import { auth, db } from '../firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut, 
  updatePassword as firebaseUpdatePassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

interface AuthContextType {
  user: User | null;
  permissions: UserPermission | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updatePassword: (newPassword: string) => Promise<boolean>;
  isLoading: boolean;
  canAccessProject: (projectId: string) => boolean;
  canAccessExperiment: (projectId: string, experimentDate: string) => boolean;
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<UserPermission | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let userUnsubscribe: (() => void) | null = null;
    let notificationUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Listen to user profile changes in real-time
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        userUnsubscribe = onSnapshot(userDocRef, async (userDoc) => {
          if (userDoc.exists()) {
            let userData = userDoc.data() as User;
            
            // Auto-approve bootstrap admin if needed
            const isBootstrapAdmin = firebaseUser.email?.toLowerCase() === 'amos12282000@gmail.com';
            if (isBootstrapAdmin && (!userData.isApproved || userData.role !== 'Admin')) {
              userData = { ...userData, isApproved: true, role: 'Admin' };
              setDoc(userDocRef, { isApproved: true, role: 'Admin' }, { merge: true }).catch(e => console.error('Auto-approve failed:', e));
            }
            
            setUser(userData);
            
            // Fetch permissions
            if (userData.isApproved || userData.role === 'Admin') {
              try {
                const permDocRef = doc(db, 'permissions', firebaseUser.uid);
                const permDoc = await getDoc(permDocRef);
                if (permDoc.exists()) {
                  setPermissions(permDoc.data() as UserPermission);
                } else {
                  setPermissions({ userId: firebaseUser.uid, projectIds: [] });
                }
              } catch (permError) {
                console.warn('Permissions fetch failed:', permError);
                setPermissions({ userId: firebaseUser.uid, projectIds: [] });
              }
            } else {
              setPermissions({ userId: firebaseUser.uid, projectIds: [] });
            }
          } else {
            // If user exists in Auth but not in Firestore, create a default profile
            const isBootstrapAdmin = firebaseUser.email?.toLowerCase() === 'amos12282000@gmail.com';
            const newUser: User = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              role: isBootstrapAdmin ? 'Admin' : 'User',
              isApproved: isBootstrapAdmin
            };
            
            // Re-create profile if missing (e.g. after deletion)
            setDoc(userDocRef, newUser).then(() => {
              // Notify admins of re-registration/re-activation
              if (!isBootstrapAdmin) {
                import('../services/notificationService').then(({ notifyAdmins }) => {
                  notifyAdmins('帳號重新啟用', `用戶 ${newUser.name} (${newUser.email}) 已重新登入，等待審核。`, '/users');
                }).catch(err => console.error('Failed to notify admins:', err));
              }
            }).catch(error => {
              console.error('Failed to recreate user profile:', error);
              handleFirestoreError(error, OperationType.CREATE, `users/${firebaseUser.uid}`);
            });
          }
          setIsLoading(false);
        }, (error) => {
          console.error('User profile snapshot error:', error);
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          setIsLoading(false);
        });
      } else {
        setUser(null);
        setPermissions(null);
        setNotifications([]);
        if (userUnsubscribe) userUnsubscribe();
        setIsLoading(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (userUnsubscribe) userUnsubscribe();
    };
  }, []);

  // Separate effect for notifications to handle approval status changes
  useEffect(() => {
    if (user && (user.isApproved || user.role === 'Admin')) {
      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef, 
        where('userId', '==', user.id),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
        setNotifications(notifs);
      }, (error) => {
        console.error('Notification snapshot error:', error);
        // Silently handle notification errors to avoid disrupting user experience
        // but log for debugging
      });

      return () => unsubscribe();
    } else {
      setNotifications([]);
    }
  }, [user?.id, user?.isApproved, user?.role]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Add a 15-second timeout to the login process
      const loginPromise = signInWithEmailAndPassword(auth, email, password);
      await Promise.race([
        loginPromise,
        new Promise((_, reject) => setTimeout(() => reject({ code: 'auth/timeout' }), 15000))
      ]);
      return { success: true };
    } catch (error: any) {
      console.error('Login failed:', error);
      let errorMessage = '登入失敗，請檢查帳號或密碼';
      
      if (error.code === 'auth/timeout') {
        errorMessage = '登入超時，請檢查網路連線或稍後再試。';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = '登入方法未啟用，請聯繫管理員在 Firebase 控制台啟用 Email/Password 驗證。';
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = '帳號或密碼錯誤，或該帳號尚未註冊。';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = '無效的電子郵件格式';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = '網路連線失敗，請檢查您的網路狀態。';
      }
      
      return { success: false, error: errorMessage };
    }
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const provider = new GoogleAuthProvider();
      // Add a 30-second timeout for Google login as it involves a popup
      const googlePromise = signInWithPopup(auth, provider);
      await Promise.race([
        googlePromise,
        new Promise((_, reject) => setTimeout(() => reject({ code: 'auth/timeout' }), 30000))
      ]);
      return { success: true };
    } catch (error: any) {
      console.error('Google login failed:', error);
      let errorMessage = 'Google 登入失敗';
      
      if (error.code === 'auth/timeout') {
        errorMessage = 'Google 登入超時，請檢查網路連線或是否允許彈出視窗。';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Google 登入未啟用，請聯繫管理員在 Firebase 控制台啟用 Google 驗證。';
      } else if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = '登入視窗已關閉';
      } else if (error.code === 'auth/unauthorized-domain') {
        errorMessage = '此網域未經授權進行 Google 登入。請聯繫管理員將目前網域加入 Firebase 的「授權網域」清單。';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = '登入視窗被瀏覽器攔截，請允許此網站顯示彈出視窗。';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = '網路連線失敗，請檢查您的網路狀態。';
      }
      
      return { success: false, error: errorMessage };
    }
  };

  const register = async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      // Add a 20-second timeout to the registration process
      const registerPromise = createUserWithEmailAndPassword(auth, email, password);
      const userCredential = await Promise.race([
        registerPromise,
        new Promise<any>((_, reject) => setTimeout(() => reject({ code: 'auth/timeout' }), 20000))
      ]);
      
      // Create user profile in Firestore
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const isBootstrapAdmin = email.toLowerCase() === 'amos12282000@gmail.com';
      const newUser: User = {
        id: userCredential.user.uid,
        email: email.toLowerCase(),
        name,
        role: isBootstrapAdmin ? 'Admin' : 'User',
        isApproved: isBootstrapAdmin
      };
      
      await setDoc(userDocRef, newUser);
      
      // Notify admins of new registration
      if (!isBootstrapAdmin) {
        // Don't await notification to speed up registration
        import('../services/notificationService').then(({ notifyAdmins }) => {
          notifyAdmins('新帳號申請', `用戶 ${newUser.name} (${newUser.email}) 已註冊，等待審核。`, '/users');
        }).catch(err => console.error('Failed to notify admins:', err));
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('Registration error:', error);
      let errorMessage = '註冊失敗，請稍後再試';
      
      const errorCode = error.code || (error.cause as any)?.code;
      
      if (errorCode === 'auth/timeout') {
        errorMessage = '註冊超時，請檢查網路連線或稍後再試。';
      } else if (errorCode === 'auth/email-already-in-use') {
        errorMessage = '此電子郵件已被註冊。如果您之前曾刪除過帳號，請嘗試直接使用「登入」功能以重新啟用您的帳號。';
      } else if (errorCode === 'auth/weak-password') {
        errorMessage = '密碼強度不足（至少 6 位數）';
      } else if (errorCode === 'auth/operation-not-allowed') {
        errorMessage = '註冊功能未啟用，請在 Firebase 控制台啟用 Email/Password。';
      } else if (errorCode === 'auth/invalid-email') {
        errorMessage = '無效的電子郵件格式';
      } else if (errorCode === 'auth/network-request-failed') {
        errorMessage = '網路連線失敗，請檢查您的網路狀態。';
      }
      
      return { success: false, error: errorMessage };
    }
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error: any) {
      console.error('Reset password failed:', error);
      let errorMessage = '發送重設郵件失敗';
      if (error.code === 'auth/user-not-found') {
        errorMessage = '找不到此電子郵件對應的帳號';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = '無效的電子郵件格式';
      }
      return { success: false, error: errorMessage };
    }
  };

  const updatePassword = async (newPassword: string): Promise<boolean> => {
    if (!auth.currentUser) return false;
    
    try {
      await firebaseUpdatePassword(auth.currentUser, newPassword);
      return true;
    } catch (error) {
      console.error('Update password failed:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const canAccessProject = (projectId: string): boolean => {
    if (!user) return false;
    if (user.role === 'Admin') return true;
    return permissions?.projectIds.includes(projectId) || false;
  };

  const canAccessExperiment = (projectId: string, experimentDate: string): boolean => {
    if (!user) return false;
    if (user.role === 'Admin') return true;
    
    const expDate = new Date(experimentDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Check per-project limits first
    const projectLimit = permissions?.projectAccessLimits?.[projectId];
    if (projectLimit) {
      // Relative limit
      if (projectLimit.relativeAccessDays) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - projectLimit.relativeAccessDays);
        cutoff.setHours(0, 0, 0, 0);
        if (expDate < cutoff) return false;
      }

      // Absolute limits
      if (projectLimit.startDate) {
        const start = new Date(projectLimit.startDate);
        if (expDate < start) return false;
      }
      if (projectLimit.endDate) {
        const end = new Date(projectLimit.endDate);
        end.setHours(23, 59, 59, 999);
        if (expDate > end) return false;
      }
      return true;
    }

    // Fallback to global limits
    // Global relative limit
    if (user.relativeAccessDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - user.relativeAccessDays);
      cutoff.setHours(0, 0, 0, 0);
      if (expDate < cutoff) return false;
    }

    // Global absolute limits
    if (user.accessStartDate) {
      const start = new Date(user.accessStartDate);
      if (expDate < start) return false;
    }
    if (user.accessEndDate) {
      const end = new Date(user.accessEndDate);
      end.setHours(23, 59, 59, 999);
      if (expDate > end) return false;
    }
    return true;
  };

  const markAsRead = async (id: string) => {
    const { markNotificationAsRead } = await import('../services/notificationService');
    await markNotificationAsRead(id);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AuthContext.Provider value={{ 
      user, 
      permissions, 
      login, 
      register, 
      loginWithGoogle, 
      resetPassword,
      logout, 
      updatePassword, 
      isLoading, 
      canAccessProject, 
      canAccessExperiment,
      notifications,
      unreadCount,
      markAsRead
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
