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
    const user = await verifyUser(input.email, input.password);
    if (!user) {
      throw new Error("Invalid email or password");
    }

    const secret = process.env.JWT_SECRET ?? "dev_secret_change_me";
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, secret, { expiresIn: "30d" });

    return { id: user.id, email: user.email, name: user.name, token };
  });
