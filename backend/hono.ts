import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

// app will be mounted at /api
const app = new Hono();

// Enable CORS for all routes
app.use("*", cors());

// Mount tRPC router at /trpc
app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
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