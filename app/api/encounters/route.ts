import { z } from 'zod';
import { db } from '@/lib/db';
import { encounters, patients, users, auditLogs } from '@/drizzle/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { err, ok, parseJson } from '@/lib/api';

export async function GET(req: Request) {
  const auth = await apiAuth();
  if ('error' in auth) return auth.error;
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const branchId = auth.session.branchId;

  const rows = await db.select({
    id: encounters.id,
    queueNo: encounters.queueNo,
    status: encounters.status,
    complaint: encounters.complaint,
    arrivedAt: encounters.arrivedAt,
    syncStatus: encounters.syncStatus,
    patient: { id: patients.id, name: patients.name, rmNumber: patients.rmNumber, penjamin: patients.penjamin },
    doctor: { id: users.id, name: users.name },
  })
    .from(encounters)
    .innerJoin(patients, eq(patients.id, encounters.patientId))
    .innerJoin(users, eq(users.id, encounters.doctorId))
    .where(and(
      eq(encounters.branchId, branchId),
      status ? eq(encounters.status, status as 'menunggu') : sql`true`,
    ))
    .orderBy(desc(encounters.arrivedAt))
    .limit(100);

  return ok({ data: rows });
}

const Create = z.object({
  patientId: z.string().uuid('patientId tidak valid'),
  doctorId: z.string().uuid('doctorId tidak valid'),
  complaint: z.string().optional().or(z.literal('')),
});

export async function POST(req: Request) {
  const auth = await apiAuth(['admin', 'pendaftaran', 'perawat']);
  if ('error' in auth) return auth.error;
  const parsed = await parseJson(req, Create);
  if ('error' in parsed) return parsed.error;
  const { patientId, doctorId, complaint } = parsed.data;
  const branchId = auth.session.branchId;

  const [p] = await db.select().from(patients).where(and(eq(patients.id, patientId), eq(patients.branchId, branchId))).limit(1);
  if (!p) return err('NOT_FOUND', 'Pasien tidak ditemukan', 404);

  const [d] = await db.select().from(users).where(and(eq(users.id, doctorId), eq(users.role, 'dokter'))).limit(1);
  if (!d) return err('NOT_FOUND', 'Dokter tidak ditemukan', 404);

  // Generate antrian per hari (A-001…)
  const result = await db.execute(sql`
    SELECT coalesce(max(substring(queue_no from 3)::int), 0) + 1 AS next
    FROM encounters
    WHERE branch_id = ${branchId} AND arrived_at::date = (now() at time zone 'Asia/Jakarta')::date
  `);
  const next = Number((result as unknown as { next: number }[])[0]?.next ?? 1);
  const queueNo = `A-${String(next).padStart(3, '0')}`;

  const [row] = await db.insert(encounters).values({
    branchId, queueNo, patientId, doctorId, complaint: complaint || null,
    status: 'menunggu', source: 'walk_in',
  }).returning();

  await db.insert(auditLogs).values({
    actorId: auth.session.sub, action: 'create', entity: 'encounter', entityId: row.id, meta: { queueNo },
  });
  return ok({ data: row }, 201);
}
