import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

const users: StoredUser[] = [];

export function getUserByEmail(email: string): StoredUser | undefined {
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export async function createUser(email: string, password: string, name?: string): Promise<StoredUser> {
  const id = randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  const user: StoredUser = {
    id,
    email,
    name: name ?? email.split("@")[0],
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  return user;
}

export async function verifyUser(email: string, password: string): Promise<StoredUser | null> {
  const existing = getUserByEmail(email);
  if (!existing) return null;
  const ok = await bcrypt.compare(password, existing.passwordHash);
  return ok ? existing : null;
}
