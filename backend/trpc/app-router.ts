import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import signupRoute from "./routes/auth/signup";
import loginRoute from "./routes/auth/login";
import { generateSheetLayoutProcedure } from "./routes/stickers/generate-sheet-layout";

console.log('[app-router] Creating app router with auth routes');

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  auth: createTRPCRouter({
    signup: signupRoute,
    login: loginRoute,
  }),
  stickers: createTRPCRouter({
    generateSheetLayout: generateSheetLayoutProcedure,
  }),
});

console.log('[app-router] App router created successfully');

export type AppRouter = typeof appRouter;