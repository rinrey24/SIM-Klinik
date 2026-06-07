import { db } from '@/lib/db';
import { bills, billItems, patients } from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { err, ok } from '@/lib/api';

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await apiAuth();
  if ('error' in auth) return auth.error;
  const { id } = await ctx.params;

  const [bill] = await db.select({
    id: bills.id, status: bills.status, total: bills.total, payMethod: bills.payMethod,
    paidAt: bills.paidAt, createdAt: bills.createdAt, encounterId: bills.encounterId,
    patient: { id: patients.id, name: patients.name, rmNumber: patients.rmNumber, penjamin: patients.penjamin, phone: patients.phone, bpjsNumber: patients.bpjsNumber },
  })
    .from(bills)
    .innerJoin(patients, eq(patients.id, bills.patientId))
    .where(and(eq(bills.id, id), eq(bills.branchId, auth.session.branchId)))
    .limit(1);
  if (!bill) return err('NOT_FOUND', 'Tagihan tidak ditemukan', 404);

  const items = await db.select().from(billItems).where(eq(billItems.billId, id));
  return ok({ data: { ...bill, items } });
}
