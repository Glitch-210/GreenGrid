import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useApiQuery<T>(key: unknown[], url: string, enabled = true) {
  return useQuery<T>({
    queryKey: key,
    queryFn: async () => {
      const res = await api.get(url);
      return res.data.data as T;
    },
    enabled,
  });
}
