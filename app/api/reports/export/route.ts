import { db } from '@/lib/db';
import { bills, billItems, patients, encounters, users } from '@/drizzle/schema';
import { and, eq, gte, lt } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { err } from '@/lib/api';

function csvEscape(v: unknown) {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const auth = await apiAuth(['admin']);
  if ('error' in auth) return auth.error;
  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? 'bills';
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const start = from ? new Date(from + 'T00:00:00') : (() => { const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0,0,0,0); return d; })();
  const end = to ? new Date(to + 'T00:00:00') : new Date();
  if (!to) end.setHours(23,59,59,999); else end.setDate(end.getDate() + 1);

  if (type !== 'bills') return err('VALIDATION_ERROR', 'type harus "bills"', 422);

  const rows = await db.select({
    paidAt: bills.paidAt, createdAt: bills.createdAt,
    status: bills.status, method: bills.payMethod, total: bills.total,
    patientName: patients.name, rmNumber: patients.rmNumber, penjamin: patients.penjamin,
    doctorName: users.name, queueNo: encounters.queueNo,
  })
    .from(bills)
    .innerJoin(patients, eq(patients.id, bills.patientId))
    .innerJoin(encounters, eq(encounters.id, bills.encounterId))
    .innerJoin(users, eq(users.id, encounters.doctorId))
    .where(and(
      eq(bills.branchId, auth.session.branchId),
      gte(bills.createdAt, start),
      lt(bills.createdAt, end),
    ));

  const header = ['Tanggal', 'No. Antrian', 'Pasien', 'No. RM', 'Penjamin', 'Dokter', 'Status', 'Metode', 'Total (Rp)'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      (r.paidAt ?? r.createdAt).toISOString(),
      r.queueNo, r.patientName, r.rmNumber, r.penjamin,
      r.doctorName, r.status, r.method ?? '', r.total,
    ].map(csvEscape).join(','));
  }
  const csv = lines.join('\n');
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tagihan-${stamp}.csv"`,
    },
  });
}
