import { createTRPCReact } from "@trpc/react-query";
import { createTRPCClient, httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import { getAuthToken } from "@/lib/authToken";
import Constants from "expo-constants";

export const trpc = createTRPCReact<AppRouter>();

const DEFAULT_RORK_BASE_URL = "https://dev-m7gyp7dzka89rw149zpa5.rorktest.dev" as const;

const getBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL ?? Constants.expoConfig?.extra?.EXPO_PUBLIC_RORK_API_BASE_URL ?? Constants.manifest2?.extra?.EXPO_PUBLIC_RORK_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.length > 0) {
    console.log('[trpc] Using env base URL:', envUrl);
    return envUrl.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    console.log('[trpc] Using window.location.origin:', window.location.origin);
    return window.location.origin.replace(/\/$/, '');
  }

  console.warn('[trpc] No env base URL found, falling back to default Rork tunnel URL');
  return DEFAULT_RORK_BASE_URL;
};

const baseUrl = getBaseUrl();
const trpcUrl = `${baseUrl.replace(/\/$/, '')}/api/trpc`;
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
        console.log('[trpc] 🔄 Making request to:', url);
        console.log('[trpc] Request options:', {
          method: options?.method,
          headers: options?.headers,
          body: options?.body ? 'present' : 'none'
        });
        
        const timeoutMs = 120000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        const fetchOptions = {
          ...options,
          signal: controller.signal,
        };
        
        return fetch(url, fetchOptions)
          .then(response => {
            clearTimeout(timeoutId);
            console.log('[trpc] ✅ Response status:', response.status);
            console.log('[trpc] Response ok:', response.ok);
            if (!response.ok) {
              console.error('[trpc] ❌ Response not ok:', response.status, response.statusText);
            }
            return response;
          })
          .catch(error => {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
              console.error('[trpc] ⏱️ Request timeout after', timeoutMs, 'ms');
              throw new Error(`Request timeout after ${timeoutMs}ms`);
            }
            console.error('[trpc] ❌ Fetch error:', error);
            console.error('[trpc] Error details:', {
              name: error.name,
              message: error.message,
              stack: error.stack
            });
            
            if (error.message === 'Failed to fetch') {
              console.error('[trpc] 🔴 NETWORK ERROR: Cannot connect to backend');
              console.error('[trpc] Check if:');
              console.error('[trpc] 1. Backend server is running (run: bun start)');
              console.error('[trpc] 2. EXPO_PUBLIC_RORK_API_BASE_URL is correct:', process.env.EXPO_PUBLIC_RORK_API_BASE_URL);
              console.error('[trpc] 3. CORS is properly configured');
              console.error('[trpc] 4. Network connection is stable');
              console.error('[trpc] 5. Try restarting the development server');
              throw new Error('Cannot connect to backend server. Make sure the development server is running with "bun start".');
            }
            
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
      fetch(url, options) {
        const timeoutMs = 120000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        const fetchOptions = {
          ...options,
          signal: controller.signal,
        };
        
        return fetch(url, fetchOptions)
          .then(response => {
            clearTimeout(timeoutId);
            return response;
          })
          .catch(error => {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
              throw new Error(`Request timeout after ${timeoutMs}ms`);
            }
            if (error.message === 'Failed to fetch') {
              throw new Error('Cannot connect to backend server. Make sure the development server is running with "bun start".');
            }
            throw error;
          });
      },
    }),
  ],
});