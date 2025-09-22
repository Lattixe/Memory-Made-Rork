import { z } from "zod";
import jwt from "jsonwebtoken";
import { publicProcedure } from "@/backend/trpc/create-context";
import { createUser, getUserByEmail } from "./store";

const SignupInput = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
});

export default publicProcedure
  .input(SignupInput)
  .mutation(async ({ input }) => {
    try {
      console.log('[signup] Signup procedure called');
      console.log('[signup] Attempting signup for:', input.email);
      
      const exists = getUserByEmail(input.email);
      if (exists) {
        console.log('[signup] Email already exists:', input.email);
        throw new Error("Email already in use");
      }

      console.log('[signup] Creating user...');
      const user = await createUser(input.email, input.password, input.name);
      console.log('[signup] User created successfully:', { id: user.id, email: user.email, name: user.name });
      
      console.log('[signup] Generating JWT token...');
      const secret = process.env.JWT_SECRET ?? "dev_secret_change_me";
      const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, secret, { expiresIn: "30d" });
      console.log('[signup] JWT token generated successfully');

      const result = { id: user.id, email: user.email, name: user.name, token };
      console.log('[signup] Returning result:', { ...result, token: '***' });
      return result;
    } catch (error: any) {
      console.error('[signup] Error in signup procedure:', error);
      throw error;
    }
  });
