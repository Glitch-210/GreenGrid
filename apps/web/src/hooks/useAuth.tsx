import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../lib/api";
import type { Role, UserDTO } from "@wattshare/shared";

interface StoredUser extends UserDTO {}

interface AuthContextValue {
  user: StoredUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<StoredUser>;
  register: (name: string, email: string, password: string, role: Role) => Promise<StoredUser>;
  logout: () => void;
}

function readStoredUser(): StoredUser | null {
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    // Malformed storage must not throw during render.
    localStorage.removeItem("user");
    return null;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(readStoredUser);

  const persist = useCallback((token: string, u: StoredUser) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post("/auth/login", { email, password });
      const { token, user: u } = res.data.data;
      persist(token, u);
      return u as StoredUser;
    },
    [persist],
  );

  const register = useCallback(
    async (name: string, email: string, password: string, role: Role) => {
      const res = await api.post("/auth/register", { name, email, password, role });
      const { token, user: u } = res.data.data;
      persist(token, u);
      return u as StoredUser;
    },
    [persist],
  );

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: !!user, login, register, logout }),
    [user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an <AuthProvider>");
  return ctx;
}
