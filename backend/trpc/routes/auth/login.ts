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
    console.log('[login] Login procedure called');
    console.log('[login] Attempting login for:', input.email);
    
    const user = await verifyUser(input.email, input.password);
    if (!user) {
      console.log('[login] Invalid credentials for:', input.email);
      throw new Error("Invalid email or password");
    }

    console.log('[login] Login successful for:', { id: user.id, email: user.email, name: user.name });
    
    const secret = process.env.JWT_SECRET ?? "dev_secret_change_me";
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, secret, { expiresIn: "30d" });

    return { id: user.id, email: user.email, name: user.name, token };
  });
