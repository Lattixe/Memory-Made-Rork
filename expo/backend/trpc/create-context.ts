import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import jwt from "jsonwebtoken";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

// Context creation function
export const createContext = async (opts: FetchCreateContextFnOptions) => {
  let user: AuthUser | null = null;
  try {
    const authHeader = opts.req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const secret = process.env.JWT_SECRET ?? "dev_secret_change_me";
    if (token) {
      const decoded = jwt.verify(token, secret) as AuthUser & { iat?: number; exp?: number };
      if (decoded?.id && decoded?.email) {
        user = { id: decoded.id, email: decoded.email, name: decoded.name };
      }
    }
  } catch (e) {
    // Ignore invalid token
  }
  return {
    req: opts.req,
    user,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

// Initialize tRPC
const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new Error("UNAUTHORIZED");
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(isAuthed);