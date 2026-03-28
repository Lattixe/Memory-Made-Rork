import { z } from "zod";
import jwt from "jsonwebtoken";
import { publicProcedure } from "@/backend/trpc/create-context";
import { verifyUser } from "./store";

const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export default publicProcedure
  .input(LoginInput)
  .mutation(async ({ input }) => {
    try {
      console.log('[login] Login procedure called');
      console.log('[login] Attempting login for:', input.email);
      
      console.log('[login] Verifying user credentials...');
      const user = await verifyUser(input.email, input.password);
      if (!user) {
        console.log('[login] Invalid credentials for:', input.email);
        throw new Error("Invalid email or password");
      }

      console.log('[login] Login successful for:', { id: user.id, email: user.email, name: user.name });
      
      console.log('[login] Generating JWT token...');
      const secret = process.env.JWT_SECRET ?? "dev_secret_change_me";
      const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, secret, { expiresIn: "30d" });
      console.log('[login] JWT token generated successfully');

      const result = { id: user.id, email: user.email, name: user.name, token };
      console.log('[login] Returning result:', { ...result, token: '***' });
      return result;
    } catch (error: any) {
      console.error('[login] Error in login procedure:', error);
      throw error;
    }
  });
