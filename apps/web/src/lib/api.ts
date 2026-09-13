import axios from "axios";

const apiOrigin = import.meta.env.VITE_API_ORIGIN ?? "";

export const api = axios.create({
  baseURL: apiOrigin ? `${apiOrigin}/api/v1` : "/api/v1",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Set by AuthProvider to its own logout(). The interceptor cannot call a hook,
 * and clearing storage from here is not enough on its own: the mounted tree
 * keeps its copy of `user`, so `isAuthenticated` stays true and RequireAuth
 * keeps rendering a dead session. Routing the 401 through the context clears
 * the user, drops the socket, and lets RequireAuth redirect to /login — so app
 * state and the URL stay consistent without a hard navigate.
 */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (res) => res,
  (error) => {
    // A rejected sign-in is a failed attempt, not an expired session — treating
    // it as one would tear down state the user never had.
    const isAuthAttempt = (error.config?.url ?? "").startsWith("/auth/");
    if (error.response?.status === 401 && !isAuthAttempt) {
      if (onUnauthorized) {
        onUnauthorized();
      } else {
        // Before the provider mounts, clear both keys — leaving `user` behind is
        // what let a dead session render as a healthy one.
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }
    return Promise.reject(error);
  },
);
