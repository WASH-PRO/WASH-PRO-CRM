import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  getProfile,
  getStoredPermissions,
  getStoredUser,
  login as apiLogin,
  logout as apiLogout,
} from '../api/client';
import type { Permission, User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (...perms: Permission[]) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = getStoredUser<User>();
  const [user, setUser] = useState<User | null>(
    stored ? { ...stored, permissions: stored.permissions || getStoredPermissions() } : null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfile()
      .then((profile) => {
        setUser({ ...profile, permissions: getStoredPermissions() });
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (loginName: string, password: string) => {
    const result = await apiLogin(loginName, password);
    setUser(result.user as User);
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  const hasPermission = (...perms: Permission[]) => {
    if (!user?.permissions) return false;
    return perms.some((p) => user.permissions!.includes(p));
  };

  const isAdmin = hasPermission('manage_users', 'view_logs');

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
