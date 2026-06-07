import { db } from '@/lib/db';
import { prescriptions, prescriptionItems, drugs, encounters } from '@/drizzle/schema';
import { and, eq, gte, lt, sql, desc } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { ok } from '@/lib/api';

export async function GET(req: Request) {
  const auth = await apiAuth(['admin']);
  if ('error' in auth) return auth.error;
  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const start = from ? new Date(from + 'T00:00:00') : (() => { const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0,0,0,0); return d; })();
  const end = to ? new Date(to + 'T00:00:00') : new Date();
  if (!to) end.setHours(23,59,59,999); else end.setDate(end.getDate() + 1);

  const rows = await db.select({
    drugId: drugs.id,
    name: drugs.name,
    total: sql<number>`coalesce(sum(${prescriptionItems.qty})::int, 0)`,
  })
    .from(prescriptionItems)
    .innerJoin(prescriptions, eq(prescriptions.id, prescriptionItems.prescriptionId))
    .innerJoin(encounters, eq(encounters.id, prescriptions.encounterId))
    .innerJoin(drugs, eq(drugs.id, prescriptionItems.drugId))
    .where(and(
      eq(encounters.branchId, auth.session.branchId),
      eq(prescriptions.status, 'diserahkan'),
      gte(prescriptions.dispensedAt, start),
      lt(prescriptions.dispensedAt, end),
    ))
    .groupBy(drugs.id, drugs.name)
    .orderBy(desc(sql`sum(${prescriptionItems.qty})`))
    .limit(10);

  return ok({ data: rows });
}
