import { db } from '@/lib/db';
import { prescriptions, encounters, auditLogs } from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { err, ok } from '@/lib/api';

export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await apiAuth(['admin', 'apoteker']);
  if ('error' in auth) return auth.error;
  const { id } = await ctx.params;

  const [rx] = await db.select({ id: prescriptions.id, status: prescriptions.status, encounterBranchId: encounters.branchId })
    .from(prescriptions)
    .innerJoin(encounters, eq(encounters.id, prescriptions.encounterId))
    .where(eq(prescriptions.id, id)).limit(1);
  if (!rx || rx.encounterBranchId !== auth.session.branchId) return err('NOT_FOUND', 'Resep tidak ditemukan', 404);
  if (rx.status !== 'masuk') return err('CONFLICT', 'Resep tidak dalam status masuk', 409);

  const [row] = await db.update(prescriptions).set({ status: 'disiapkan' }).where(eq(prescriptions.id, id)).returning();
  await db.insert(auditLogs).values({ actorId: auth.session.sub, action: 'prep_prescription', entity: 'prescription', entityId: id });
  return ok({ data: row });
}
