import { db } from '@/lib/db';
import { bills, patients } from '@/drizzle/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { ok } from '@/lib/api';

export async function GET(req: Request) {
  const auth = await apiAuth();
  if ('error' in auth) return auth.error;
  const url = new URL(req.url);
  const status = url.searchParams.get('status');

  const rows = await db.select({
    id: bills.id, status: bills.status, total: bills.total, payMethod: bills.payMethod,
    paidAt: bills.paidAt, createdAt: bills.createdAt, encounterId: bills.encounterId,
    patient: { id: patients.id, name: patients.name, rmNumber: patients.rmNumber, penjamin: patients.penjamin, phone: patients.phone },
  })
    .from(bills)
    .innerJoin(patients, eq(patients.id, bills.patientId))
    .where(and(
      eq(bills.branchId, auth.session.branchId),
      status ? eq(bills.status, status as 'belum') : sql`true`,
    ))
    .orderBy(desc(bills.createdAt))
    .limit(100);

  return ok({ data: rows });
}
