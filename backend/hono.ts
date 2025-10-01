import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

// app will be mounted at /api
const app = new Hono();

// Add middleware to log all requests BEFORE other handlers
app.use('*', async (c, next) => {
  console.log('[backend] Request:', c.req.method, c.req.url);
  await next();
  console.log('[backend] Response status:', c.res.status);
});

// Enable CORS for all routes
app.use("*", cors());

// Mount tRPC router at /trpc with timeout handling
app.use(
  "/trpc/*",
  async (c, next) => {
    const timeoutMs = 25000;
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
    });

    try {
      await Promise.race([next(), timeoutPromise]);
    } catch (error: any) {
      if (error.message === 'Request timeout') {
        console.error('[backend] Request timeout after', timeoutMs, 'ms');
        return c.json({ error: 'Request timeout' }, 504);
      }
      throw error;
    }
  },
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
    onError: ({ error, path }) => {
      console.error('[backend] tRPC error on path:', path);
      console.error('[backend] tRPC error:', error);
      console.error('[backend] tRPC error stack:', error.stack);
    },
  })
);

// Simple health check endpoint
app.get("/", (c) => {
  console.log('[backend] Health check endpoint hit');
  return c.json({ status: "ok", message: "API is running" });
});

// Debug endpoint to check if backend is working
app.get("/debug", (c) => {
  console.log('[backend] Debug endpoint hit');
  return c.json({ 
    status: "ok", 
    message: "Backend is working",
    timestamp: new Date().toISOString(),
    routes: {
      health: "/api/",
      trpc: "/api/trpc",
      debug: "/api/debug"
    }
  });
});

export default app;