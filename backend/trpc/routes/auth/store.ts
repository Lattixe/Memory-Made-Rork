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

// Create a test user for debugging
(async () => {
  try {
    console.log('[store] Creating test user for debugging...');
    const testUser = await createUser('test@example.com', 'password123', 'Test User');
    console.log('[store] Test user created:', { id: testUser.id, email: testUser.email, name: testUser.name });
  } catch (error) {
    console.error('[store] Error creating test user:', error);
  }
})();

export function getUserByEmail(email: string): StoredUser | undefined {
  console.log('[store] Looking for user with email:', email);
  console.log('[store] Available users:', users.map(u => u.email));
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  console.log('[store] User found:', !!user);
  return user;
}

export async function createUser(email: string, password: string, name?: string): Promise<StoredUser> {
  console.log('[store] Creating user with email:', email);
  const id = randomUUID();
  console.log('[store] Generated user ID:', id);
  
  console.log('[store] Hashing password...');
  const passwordHash = await bcrypt.hash(password, 10);
  console.log('[store] Password hashed successfully');
  
  const user: StoredUser = {
    id,
    email,
    name: name ?? email.split("@")[0],
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  
  users.push(user);
  console.log('[store] User added to store. Total users:', users.length);
  console.log('[store] Created user:', { id: user.id, email: user.email, name: user.name });
  
  return user;
}

export async function verifyUser(email: string, password: string): Promise<StoredUser | null> {
  console.log('[store] Verifying user with email:', email);
  console.log('[store] Total users in store:', users.length);
  
  const existing = getUserByEmail(email);
  if (!existing) {
    console.log('[store] User not found:', email);
    return null;
  }
  
  console.log('[store] User found, verifying password...');
  const ok = await bcrypt.compare(password, existing.passwordHash);
  console.log('[store] Password verification result:', ok);
  
  return ok ? existing : null;
}
