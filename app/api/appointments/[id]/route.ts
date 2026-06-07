import { z } from 'zod';
import { db } from '@/lib/db';
import { appointments, auditLogs } from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { err, ok, parseJson } from '@/lib/api';

const Patch = z.object({
  status: z.enum(['terjadwal', 'selesai', 'batal']).optional(),
  note: z.string().optional(),
  patientId: z.string().uuid().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await apiAuth(['admin', 'pendaftaran']);
  if ('error' in auth) return auth.error;
  const { id } = await ctx.params;
  const parsed = await parseJson(req, Patch);
  if ('error' in parsed) return parsed.error;

  const [existing] = await db.select().from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.branchId, auth.session.branchId))).limit(1);
  if (!existing) return err('NOT_FOUND', 'Janji tidak ditemukan', 404);

  const [row] = await db.update(appointments).set(parsed.data).where(eq(appointments.id, id)).returning();
  await db.insert(auditLogs).values({
    actorId: auth.session.sub, action: 'update', entity: 'appointment', entityId: id, meta: parsed.data,
  });
  return ok({ data: row });
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await apiAuth(['admin', 'pendaftaran']);
  if ('error' in auth) return auth.error;
  const { id } = await ctx.params;
  const [existing] = await db.select().from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.branchId, auth.session.branchId))).limit(1);
  if (!existing) return err('NOT_FOUND', 'Janji tidak ditemukan', 404);
  await db.update(appointments).set({ status: 'batal' }).where(eq(appointments.id, id));
  await db.insert(auditLogs).values({
    actorId: auth.session.sub, action: 'cancel', entity: 'appointment', entityId: id,
  });
  return ok({ success: true });
}
