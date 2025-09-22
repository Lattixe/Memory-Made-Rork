import { createTRPCReact } from "@trpc/react-query";
import { createTRPCClient, httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import { getAuthToken } from "@/lib/authToken";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_RORK_API_BASE_URL) {
    console.log('[trpc] Using EXPO_PUBLIC_RORK_API_BASE_URL:', process.env.EXPO_PUBLIC_RORK_API_BASE_URL);
    return process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  }
  if (typeof window !== 'undefined') {
    console.log('[trpc] Using window.location.origin:', window.location.origin);
    return window.location.origin;
  }
  throw new Error(
    "No base url found, please set EXPO_PUBLIC_RORK_API_BASE_URL"
  );
};

const baseUrl = getBaseUrl();
const trpcUrl = `${baseUrl}/api/trpc`;
console.log('[trpc] Creating tRPC client with URL:', trpcUrl);

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpLink({
      url: trpcUrl,
      transformer: superjson,
      headers() {
        const token = getAuthToken();
        console.log('[trpc] Request headers - token present:', !!token);
        return token ? { authorization: `Bearer ${token}` } : {};
      },
      fetch(url, options) {
        console.log('[trpc] Making request to:', url);
        console.log('[trpc] Request options:', {
          method: options?.method,
          headers: options?.headers,
          body: options?.body ? 'present' : 'none'
        });
        return fetch(url, options).then(response => {
          console.log('[trpc] Response status:', response.status);
          console.log('[trpc] Response ok:', response.ok);
          if (!response.ok) {
            console.error('[trpc] Response not ok:', response.status, response.statusText);
          }
          return response;
        }).catch(error => {
          console.error('[trpc] Fetch error:', error);
          throw error;
        });
      },
    }),
  ],
});

export const trpcReactClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      headers() {
        const token = getAuthToken();
        return token ? { authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});