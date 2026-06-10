import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { buildApiUrl } from "./api-config";

type UnauthorizedBehavior = "redirect" | "throw";

// Global navigation callback - will be set by the app
let navigateToAuth: (() => void) | null = null;

// Function to set the navigation callback
export function setAuthNavigationCallback(callback: () => void) {
  navigateToAuth = callback;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

// Helper function to get tenant ID from localStorage
function getTenantId(): string | null {
  return localStorage.getItem("tenantId");
}

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const tenantId = getTenantId();
    const headers: Record<string, string> = {
      ...(tenantId ? { "x-tenant-id": tenantId } : {})
    };

    const apiUrl = buildApiUrl(queryKey[0] as string);
    console.log('QueryClient: Making request to:', apiUrl);
    console.log('QueryClient: Tenant ID:', tenantId);
    console.log('QueryClient: Headers:', headers);

    const res = await fetch(apiUrl, {
      headers,
      credentials: "include",
    });

    if (res.status === 401) {
      if (unauthorizedBehavior === "redirect") {
        // Use the navigation callback if available, otherwise fallback to window.location
        if (navigateToAuth) {
          navigateToAuth();
        } else {
          window.location.href = "/auth";
        }
      }
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    return res.json();
  };

export const apiRequest = async (
  method: string,
  url: string,
  data?: any
): Promise<Response> => {
  const tenantId = getTenantId();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(tenantId ? { "x-tenant-id": tenantId } : {})
  };

  const apiUrl = buildApiUrl(url);
  console.log('QueryClient: API request to:', apiUrl);
  console.log('QueryClient: Method:', method);
  console.log('QueryClient: Tenant ID:', tenantId);
  console.log('QueryClient: Headers:', headers);

  const res = await fetch(apiUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
};

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let error: Error;
    try {
      const data = await res.json();
      // Include validation error details in the message if available
      let message = data.message || "API Error";
      if (data.errors && Array.isArray(data.errors)) {
        const details = data.errors.map((e: any) => `${e.path?.join('.') || 'field'}: ${e.message}`).join('; ');
        message = `${message}: ${details}`;
      }
      if (data.detail) {
        message = `${message}: ${data.detail}`;
      }
      if (data.error) {
        message = `${message}: ${data.error}`;
      }
      error = new Error(message);
      Object.assign(error, data);
    } catch {
      error = new Error("API Error");
    }
    throw error;
  }
}
