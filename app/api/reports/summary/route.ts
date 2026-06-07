import { db } from '@/lib/db';
import { bills, encounters, prescriptions, patients } from '@/drizzle/schema';
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { ok } from '@/lib/api';

function parseRange(url: URL) {
  const from = url.searchParams.get('from'); // YYYY-MM-DD
  const to = url.searchParams.get('to');
  const start = from ? new Date(from + 'T00:00:00') : (() => { const d = new Date(); d.setDate(d.getDate() - 6); d.setHours(0,0,0,0); return d; })();
  const end = to ? new Date(to + 'T00:00:00') : new Date();
  if (!to) end.setHours(23,59,59,999);
  else end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function GET(req: Request) {
  const auth = await apiAuth(['admin']);
  if ('error' in auth) return auth.error;
  const branchId = auth.session.branchId;
  const { start, end } = parseRange(new URL(req.url));

  const [pendapatan] = await db.select({
    total: sql<number>`coalesce(sum(${bills.total})::float, 0)`,
    n: sql<number>`count(*)::int`,
  }).from(bills).where(and(
    eq(bills.branchId, branchId),
    eq(bills.status, 'lunas'),
    gte(bills.paidAt, start),
    lt(bills.paidAt, end),
  ));

  const [kunjungan] = await db.select({ n: sql<number>`count(*)::int` })
    .from(encounters).where(and(
      eq(encounters.branchId, branchId),
      gte(encounters.arrivedAt, start),
      lt(encounters.arrivedAt, end),
    ));

  const [resep] = await db.select({ n: sql<number>`count(*)::int` })
    .from(prescriptions)
    .innerJoin(encounters, eq(encounters.id, prescriptions.encounterId))
    .where(and(
      eq(encounters.branchId, branchId),
      eq(prescriptions.status, 'diserahkan'),
      gte(prescriptions.dispensedAt, start),
      lt(prescriptions.dispensedAt, end),
    ));

  // tren kunjungan per hari
  const trend = await db.execute(sql`
    SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
           coalesce(count(e.id), 0)::int AS n
    FROM generate_series(${start}::date, ${end}::date - interval '1 day', interval '1 day') AS d(day)
    LEFT JOIN encounters e
      ON e.branch_id = ${branchId}
      AND e.arrived_at::date = d.day
    GROUP BY d.day ORDER BY d.day
  `);
  const trendData = (trend as unknown as { day: string; n: number }[]);

  // komposisi penjamin
  const penjaminRows = await db.select({
    penjamin: patients.penjamin,
    n: sql<number>`count(*)::int`,
  }).from(encounters)
    .innerJoin(patients, eq(patients.id, encounters.patientId))
    .where(and(eq(encounters.branchId, branchId), gte(encounters.arrivedAt, start), lt(encounters.arrivedAt, end)))
    .groupBy(patients.penjamin);

  const avg = pendapatan.n ? pendapatan.total / pendapatan.n : 0;

  return ok({
    data: {
      range: { from: start.toISOString(), to: end.toISOString() },
      pendapatan: pendapatan.total,
      transaksi: pendapatan.n,
      rataTransaksi: avg,
      kunjungan: kunjungan.n,
      resepDilayani: resep.n,
      trend: trendData,
      penjamin: penjaminRows,
    },
  });
}
