import { useCallback, useState } from "react";
import { api } from "../lib/api";
import type { Role, UserDTO } from "@wattshare/shared";

interface StoredUser extends UserDTO {}

export function useAuth() {
  const [user, setUser] = useState<StoredUser | null>(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    const { token, user: u } = res.data.data;
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
    return u as StoredUser;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, role: Role) => {
    const res = await api.post("/auth/register", { name, email, password, role });
    const { token, user: u } = res.data.data;
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
    return u as StoredUser;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }, []);

  return { user, login, register, logout, isAuthenticated: !!user };
}
