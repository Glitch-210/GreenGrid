import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

type Method = "post" | "patch" | "delete";

interface MutationOptions {
  /** Query keys to invalidate once the write succeeds. */
  invalidates?: unknown[][];
  /**
   * Headers for the request. Pass a FUNCTION for anything that must differ per
   * call — an Idempotency-Key built once at mount would make every retry after the
   * first look like a replay of it, and the server would hand back the original
   * transaction instead of making a new one.
   */
  headers?: Record<string, string> | (() => Record<string, string>);
}

/**
 * Counterpart to useApiQuery for writes.
 *
 * Exists mainly so a successful write refreshes whatever else depends on it:
 * every write used to be a bare `api.post` that refetched only its own screen,
 * leaving the dashboard tiles and the header EC/₹ pill stale until a reload.
 *
 * `url` may be a string or built from the payload, so a single hook covers both
 * `POST /x` and `DELETE /x/:id`.
 */
export function useApiMutation<TBody = unknown, TResult = unknown>(
  method: Method,
  url: string | ((body: TBody) => string),
  { invalidates = [], headers }: MutationOptions = {},
) {
  const queryClient = useQueryClient();

  return useMutation<TResult, unknown, TBody>({
    mutationFn: async (body: TBody) => {
      const path = typeof url === "function" ? url(body) : url;
      const resolved = typeof headers === "function" ? headers() : headers;
      const config = resolved ? { headers: resolved } : undefined;
      const res = method === "delete" ? await api.delete(path, config) : await api[method](path, body, config);
      return res.data.data as TResult;
    },
    onSuccess: () => {
      for (const key of invalidates) queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/** Pull a readable message off an axios error, falling back to `fallback`. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const response = (err as { response?: { data?: { message?: string } } })?.response;
  return response?.data?.message ?? fallback;
}
