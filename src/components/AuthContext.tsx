import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserPermission } from '../types';
import { auth, db } from '../firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut, 
  updatePassword as firebaseUpdatePassword 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

interface AuthContextType {
  user: User | null;
  permissions: UserPermission | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updatePassword: (newPassword: string) => Promise<boolean>;
  isLoading: boolean;
  canAccessProject: (projectId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<UserPermission | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Fetch user profile from Firestore
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            setUser(userData);
            
            // Fetch permissions
            const permDocRef = doc(db, 'permissions', firebaseUser.uid);
            const permDoc = await getDoc(permDocRef);
            if (permDoc.exists()) {
              setPermissions(permDoc.data() as UserPermission);
            } else {
              setPermissions({ userId: firebaseUser.uid, projectIds: [] });
            }
          } else {
            // If user exists in Auth but not in Firestore, create a default profile
            // This might happen on first login if not handled elsewhere
            const newUser: User = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              role: firebaseUser.email === 'amos12282000@gmail.com' ? 'Admin' : 'User'
            };
            await setDoc(userDocRef, newUser);
            setUser(newUser);
            setPermissions({ userId: firebaseUser.uid, projectIds: [] });
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setUser(null);
        setPermissions(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true };
    } catch (error: any) {
      console.error('Login failed:', error);
      let errorMessage = '登入失敗，請檢查帳號或密碼';
      
      if (error.code === 'auth/operation-not-allowed') {
        errorMessage = '登入方法未啟用，請聯繫管理員在 Firebase 控制台啟用 Email/Password 驗證。';
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = '帳號或密碼錯誤，或該帳號尚未註冊。';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = '無效的電子郵件格式';
      }
      
      return { success: false, error: errorMessage };
    }
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      return { success: true };
    } catch (error: any) {
      console.error('Google login failed:', error);
      let errorMessage = 'Google 登入失敗';
      
      if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Google 登入未啟用，請聯繫管理員在 Firebase 控制台啟用 Google 驗證。';
      } else if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = '登入視窗已關閉';
      }
      
      return { success: false, error: errorMessage };
    }
  };

  const register = async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create user profile in Firestore
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const newUser: User = {
        id: userCredential.user.uid,
        email,
        name,
        role: email === 'amos12282000@gmail.com' ? 'Admin' : 'User'
      };
      // We do NOT save the password to Firestore for security reasons
      await setDoc(userDocRef, newUser);
      
      return { success: true };
    } catch (error: any) {
      console.error('Registration failed:', error);
      let errorMessage = '註冊失敗';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = '此電子郵件已被註冊';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = '密碼強度不足（至少 6 位數）';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = '註冊功能未啟用，請在 Firebase 控制台啟用 Email/Password。';
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

  return (
    <AuthContext.Provider value={{ user, permissions, login, register, loginWithGoogle, logout, updatePassword, isLoading, canAccessProject }}>
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
