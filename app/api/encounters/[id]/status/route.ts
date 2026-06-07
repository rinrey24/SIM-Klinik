import { z } from 'zod';
import { db } from '@/lib/db';
import { encounters, auditLogs } from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { err, ok, parseJson } from '@/lib/api';

const Schema = z.object({
  status: z.enum(['menunggu', 'dipanggil', 'dilayani', 'selesai', 'batal']),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await apiAuth(['admin', 'pendaftaran', 'dokter', 'perawat']);
  if ('error' in auth) return auth.error;
  const { id } = await ctx.params;
  const parsed = await parseJson(req, Schema);
  if ('error' in parsed) return parsed.error;

  const [existing] = await db.select().from(encounters)
    .where(and(eq(encounters.id, id), eq(encounters.branchId, auth.session.branchId))).limit(1);
  if (!existing) return err('NOT_FOUND', 'Kunjungan tidak ditemukan', 404);

  const now = new Date();
  const patch: Partial<typeof encounters.$inferInsert> = { status: parsed.data.status };
  if (parsed.data.status === 'dilayani' && !existing.startedAt) patch.startedAt = now;
  if (parsed.data.status === 'selesai' && !existing.finishedAt) patch.finishedAt = now;

  const [row] = await db.update(encounters).set(patch).where(eq(encounters.id, id)).returning();
  await db.insert(auditLogs).values({
    actorId: auth.session.sub, action: 'update_status', entity: 'encounter', entityId: id,
    meta: { from: existing.status, to: parsed.data.status },
  });
  return ok({ data: row });
}
