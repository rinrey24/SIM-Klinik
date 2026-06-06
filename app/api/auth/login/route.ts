import { z } from 'zod';
import { db } from '@/lib/db';
import { users, auditLogs } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { verify } from 'argon2';
import { createSessionFor } from '@/lib/auth/session';
import { err, ok, parseJson } from '@/lib/api';
import { logger } from '@/lib/logger';

const Schema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Kata sandi wajib diisi'),
});

export async function POST(req: Request) {
  const parsed = await parseJson(req, Schema);
  if ('error' in parsed) return parsed.error;
  const { email, password } = parsed.data;

  const [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (!u || !u.active) return err('INVALID_CREDENTIALS', 'Email atau kata sandi salah', 401);

  let okPw = false;
  try { okPw = await verify(u.passwordHash, password); }
  catch (e) { logger.warn({ e }, 'argon2 verify error'); }
  if (!okPw) return err('INVALID_CREDENTIALS', 'Email atau kata sandi salah', 401);

  await createSessionFor({ id: u.id, role: u.role, branchId: u.branchId, name: u.name });
  await db.insert(auditLogs).values({ actorId: u.id, action: 'login', entity: 'user', entityId: u.id });

  return ok({ user: { id: u.id, name: u.name, role: u.role } });
}
