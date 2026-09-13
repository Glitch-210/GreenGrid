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

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
    }
    return Promise.reject(error);
  },
);
