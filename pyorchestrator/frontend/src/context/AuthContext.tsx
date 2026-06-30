import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../api/client";

interface User {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_active?: boolean;
  permissions?: string[];
}

interface AuthCtx {
  user: User | null;
  permissions: string[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSession = async () => {
    const me = await api<User>("/api/v1/auth/me");
    setUser(me);
    if (me.permissions) {
      setPermissions(me.permissions);
      return;
    }
    try {
      const perms = await api<{ permissions: string[] }>("/api/v1/auth/me/permissions");
      setPermissions(perms.permissions);
    } catch {
      setPermissions([]);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      loadSession()
        .catch(() => localStorage.removeItem("token"))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api<{ access_token: string }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem("token", res.access_token);
    await loadSession();
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setPermissions([]);
  };

  const refreshUser = async () => {
    if (!localStorage.getItem("token")) return;
    await loadSession();
  };

  return (
    <AuthContext.Provider value={{ user, permissions, login, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}

export function can(user: User | null, perm: string, userPermissions?: string[]): boolean {
  if (!user) return false;
  if (user.role === "Administrator") return true;
  const perms = userPermissions;
  if (perms?.includes("*")) return true;
  if (perms?.length) return perms.includes(perm);
  const map: Record<string, string[]> = {
    Developer: [
      "scripts:read",
      "scripts:write",
      "scripts:run",
      "scripts:delete",
      "secrets:write",
      "groups:read",
      "schedules:write",
      "webhooks:read",
      "webhooks:write",
    ],
    Operator: ["scripts:read", "scripts:run", "scripts:disable", "groups:read", "schedules:read", "webhooks:read"],
    Viewer: ["scripts:read", "groups:read", "schedules:read", "runs:read", "webhooks:read"],
  };
  return (map[user.role] ?? []).includes(perm);
}
