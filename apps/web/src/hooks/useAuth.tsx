import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, setUnauthorizedHandler } from "../lib/api";
import { disconnectSocket } from "../lib/socket";
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
    // Drop any socket opened before this token existed. getSocket() reads the
    // token once, at construction, so a connection made earlier would stay
    // authenticated as whoever was here before.
    disconnectSocket();
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
    // Storage alone leaves a live socket still joined to the departing user's
    // `user:<id>` room, delivering their events to whoever logs in next.
    disconnectSocket();
    setUser(null);
  }, []);

  // A 401 from any request means this session is over: clear it the same way an
  // explicit logout does, so RequireAuth sends the user to /login instead of
  // rendering a dashboard that can no longer load anything.
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

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
