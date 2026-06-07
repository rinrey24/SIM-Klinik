import { z } from 'zod';
import { db } from '@/lib/db';
import { users, auditLogs } from '@/drizzle/schema';
import { and, eq, ne } from 'drizzle-orm';
import { hash } from 'argon2';
import { apiAuth } from '@/lib/auth/rbac';
import { err, ok, parseJson } from '@/lib/api';

export async function GET() {
  const auth = await apiAuth(['admin']);
  if ('error' in auth) return auth.error;
  const rows = await db.select({
    id: users.id, name: users.name, email: users.email, role: users.role,
    sip: users.sip, active: users.active, createdAt: users.createdAt,
  })
    .from(users)
    .where(eq(users.branchId, auth.session.branchId))
    .orderBy(users.role, users.name);
  return ok({ data: rows });
}

const Create = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  role: z.enum(['admin', 'pendaftaran', 'dokter', 'perawat', 'apoteker', 'kasir']),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter'),
  sip: z.string().optional().or(z.literal('')),
});

export async function POST(req: Request) {
  const auth = await apiAuth(['admin']);
  if ('error' in auth) return auth.error;
  const parsed = await parseJson(req, Create);
  if ('error' in parsed) return parsed.error;
  const d = parsed.data;
  const email = d.email.toLowerCase();

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return err('CONFLICT', 'Email sudah terdaftar', 409);

  const passwordHash = await hash(d.password);
  const [row] = await db.insert(users).values({
    branchId: auth.session.branchId,
    name: d.name, email, passwordHash, role: d.role,
    sip: d.sip || null, active: true,
  }).returning({
    id: users.id, name: users.name, email: users.email, role: users.role, sip: users.sip, active: users.active,
  });

  await db.insert(auditLogs).values({
    actorId: auth.session.sub, action: 'create', entity: 'user', entityId: row.id, meta: { role: d.role },
  });
  return ok({ data: row }, 201);
}
