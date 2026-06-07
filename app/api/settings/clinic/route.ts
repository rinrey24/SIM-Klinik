import { z } from 'zod';
import { db } from '@/lib/db';
import { branches, auditLogs } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { err, ok, parseJson } from '@/lib/api';

export async function GET() {
  const auth = await apiAuth();
  if ('error' in auth) return auth.error;
  const [b] = await db.select().from(branches).where(eq(branches.id, auth.session.branchId)).limit(1);
  if (!b) return err('NOT_FOUND', 'Klinik tidak ditemukan', 404);
  return ok({ data: b });
}

const Patch = z.object({
  name: z.string().min(2).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Format warna #RRGGBB').optional(),
});

export async function PATCH(req: Request) {
  const auth = await apiAuth(['admin']);
  if ('error' in auth) return auth.error;
  const parsed = await parseJson(req, Patch);
  if ('error' in parsed) return parsed.error;
  const [row] = await db.update(branches).set(parsed.data).where(eq(branches.id, auth.session.branchId)).returning();
  await db.insert(auditLogs).values({
    actorId: auth.session.sub, action: 'update', entity: 'branch', entityId: auth.session.branchId, meta: parsed.data,
  });
  return ok({ data: row });
}
