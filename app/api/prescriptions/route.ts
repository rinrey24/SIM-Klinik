import { db } from '@/lib/db';
import { prescriptions, prescriptionItems, patients, drugs, encounters } from '@/drizzle/schema';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { ok } from '@/lib/api';

export async function GET(req: Request) {
  const auth = await apiAuth();
  if ('error' in auth) return auth.error;
  const url = new URL(req.url);
  const status = url.searchParams.get('status');

  const rxRows = await db.select({
    id: prescriptions.id, status: prescriptions.status, createdAt: prescriptions.createdAt,
    dispensedAt: prescriptions.dispensedAt, encounterId: prescriptions.encounterId,
    patient: { id: patients.id, name: patients.name, rmNumber: patients.rmNumber, penjamin: patients.penjamin },
  })
    .from(prescriptions)
    .innerJoin(encounters, eq(encounters.id, prescriptions.encounterId))
    .innerJoin(patients, eq(patients.id, prescriptions.patientId))
    .where(and(
      eq(encounters.branchId, auth.session.branchId),
      status ? eq(prescriptions.status, status as 'masuk') : sql`true`,
    ))
    .orderBy(desc(prescriptions.createdAt))
    .limit(100);

  if (!rxRows.length) return ok({ data: [] });

  const ids = rxRows.map((r) => r.id);
  const items = await db.select({
    prescriptionId: prescriptionItems.prescriptionId,
    id: prescriptionItems.id, qty: prescriptionItems.qty, signa: prescriptionItems.signa,
    priceSnapshot: prescriptionItems.priceSnapshot,
    drug: { id: drugs.id, name: drugs.name, kind: drugs.kind, stock: drugs.stock, minStock: drugs.minStock, price: drugs.price },
  })
    .from(prescriptionItems)
    .innerJoin(drugs, eq(drugs.id, prescriptionItems.drugId))
    .where(inArray(prescriptionItems.prescriptionId, ids));

  const byRx = new Map<string, typeof items>();
  for (const it of items) {
    const arr = byRx.get(it.prescriptionId) ?? [];
    arr.push(it); byRx.set(it.prescriptionId, arr);
  }

  return ok({ data: rxRows.map((r) => ({ ...r, items: byRx.get(r.id) ?? [] })) });
}
