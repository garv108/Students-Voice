/// <reference types="vite/client" />
import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:3001";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Read response body once as text
    const text = await res.text();
    try {
      // Try to parse as JSON
      const errorData = JSON.parse(text);
      throw new Error(errorData.error || `${res.status}: ${res.statusText}`);
    } catch {
      // If not JSON, use text
      throw new Error(`${res.status}: ${text || res.statusText}`);
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined
): Promise<Response> {
  // Use API_BASE_URL for relative URLs, keep absolute URLs as-is
  const requestUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;

  const res = await fetch(requestUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

// Helper function that returns parsed JSON (like the recommended version)
export async function apiRequestJson<T = any>(
  method: string,
  url: string,
  data?: unknown | undefined
): Promise<T> {
  const response = await apiRequest(method, url, data);
  return await response.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Join query key and prepend base URL if it's a relative path
    const path = queryKey.join("/");
    const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
