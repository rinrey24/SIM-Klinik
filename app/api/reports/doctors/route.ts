import { db } from '@/lib/db';
import { encounters, users, bills } from '@/drizzle/schema';
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
    doctorId: users.id,
    name: users.name,
    sip: users.sip,
    pasien: sql<number>`count(distinct ${encounters.id})::int`,
    pendapatan: sql<number>`coalesce(sum(case when ${bills.status} = 'lunas' then ${bills.total}::float else 0 end), 0)`,
    rataDurasi: sql<number>`coalesce(avg(extract(epoch from (${encounters.finishedAt} - ${encounters.startedAt})) / 60), 0)::int`,
  })
    .from(encounters)
    .innerJoin(users, eq(users.id, encounters.doctorId))
    .leftJoin(bills, eq(bills.encounterId, encounters.id))
    .where(and(
      eq(encounters.branchId, auth.session.branchId),
      gte(encounters.arrivedAt, start),
      lt(encounters.arrivedAt, end),
    ))
    .groupBy(users.id, users.name, users.sip)
    .orderBy(desc(sql`count(distinct ${encounters.id})`));

  return ok({ data: rows });
}
