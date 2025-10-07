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
    const timeoutMs = 150000;
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
    });

    try {
      await Promise.race([next(), timeoutPromise]);
    } catch (error: any) {
      if (error.message === 'Request timeout') {
        console.error('[backend] ⏱️ Request timeout after', timeoutMs, 'ms');
        return c.json({ error: 'Request timeout' }, 504);
      }
      console.error('[backend] ❌ Middleware error:', error);
      throw error;
    }
  },
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
    onError: ({ error, path }) => {
      console.error('[backend] ❌ tRPC error on path:', path);
      console.error('[backend] tRPC error:', error);
      console.error('[backend] tRPC error stack:', error.stack);
    },
  })
);

// Replicate 851-labs background removal proxy (keeps API key server-side)
app.post('/rmbg', async (c) => {
  try {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      console.error('[backend] Missing REPLICATE_API_TOKEN');
      return c.json({ error: 'Server not configured' }, 500);
    }

    const body = await c.req.json<{ imageBase64: string }>();
    const imageBase64 = body?.imageBase64 ?? '';
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return c.json({ error: 'Invalid image' }, 400);
    }

    const startRes = await fetch('https://api.replicate.com/v1/models/851-labs/background-remover/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: {
          image: `data:image/png;base64,${imageBase64}`,
          format: 'png'
        }
      })
    });

    if (!startRes.ok) {
      const text = await startRes.text();
      console.error('[backend] Replicate start error:', startRes.status, text);
      return c.json({ error: 'Replicate start failed' }, 502);
    }

    const prediction = await startRes.json() as { id: string };
    const pollUrl = `https://api.replicate.com/v1/predictions/${prediction.id}`;

    const timeoutMs = 45000;
    const pollIntervalMs = 1200;
    const started = Date.now();

    let outputUrl: string | null = null;
    while (Date.now() - started < timeoutMs) {
      await new Promise(res => setTimeout(res, pollIntervalMs));
      const pollRes = await fetch(pollUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!pollRes.ok) {
        const text = await pollRes.text();
        console.error('[backend] Replicate poll error:', pollRes.status, text);
        break;
      }
      const data = await pollRes.json();
      const status = data?.status as string | undefined;
      if (status === 'succeeded') {
        const out = data?.output;
        if (typeof out === 'string') {
          outputUrl = out;
        } else if (Array.isArray(out) && out.length > 0 && typeof out[0] === 'string') {
          outputUrl = out[0];
        }
        break;
      }
      if (status === 'failed' || status === 'canceled') {
        console.error('[backend] Replicate status:', status, data?.error);
        break;
      }
    }

    if (!outputUrl) {
      return c.json({ error: 'Background removal timed out' }, 504);
    }

    const imgRes = await fetch(outputUrl);
    if (!imgRes.ok) {
      return c.json({ error: 'Failed to download output' }, 502);
    }
    const arrayBuf = await imgRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuf).toString('base64');
    return c.json({ base64 });
  } catch (err) {
    console.error('[backend] /rmbg error:', err);
    return c.json({ error: 'Unexpected error' }, 500);
  }
});

// Test endpoint to verify Replicate API token
app.get("/test-replicate", (c) => {
  const token = process.env.REPLICATE_API_TOKEN;
  console.log('[backend] Replicate token check:', token ? `Token present (${token.substring(0, 8)}...)` : 'Token missing');
  return c.json({ 
    status: token ? "configured" : "missing",
    message: token ? "Replicate API token is configured" : "REPLICATE_API_TOKEN environment variable is not set",
    tokenPrefix: token ? token.substring(0, 8) : null
  });
});

// Test endpoint to verify OpenAI API key
app.get("/test-openai", (c) => {
  const apiKey = process.env.OPENAI_API_KEY;
  console.log('[backend] OpenAI API key check:', apiKey ? `Key present (${apiKey.substring(0, 8)}...)` : 'Key missing');
  return c.json({ 
    status: apiKey ? "configured" : "missing",
    message: apiKey ? "OpenAI API key is configured" : "OPENAI_API_KEY environment variable is not set",
    keyPrefix: apiKey ? apiKey.substring(0, 8) : null
  });
});

// Simple health check endpoint (handle both / and empty path)
app.get("/", (c) => {
  console.log('[backend] Health check endpoint hit at /');
  return c.json({ status: "ok", message: "API is running" });
});

app.get("", (c) => {
  console.log('[backend] Health check endpoint hit at empty path');
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
      debug: "/api/debug",
      rmbg: "/api/rmbg",
      testReplicate: "/api/test-replicate",
      testOpenai: "/api/test-openai"
    },
    env: {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
      REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN ? 'configured' : 'missing'
    }
  });
});

export default app;