import { z } from 'zod';
import { db } from '@/lib/db';
import { documents, patients, users, auditLogs } from '@/drizzle/schema';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { err, ok, parseJson } from '@/lib/api';

const PREFIX: Record<string, string> = { sakit: 'SKS', sehat: 'SKD', rujukan: 'SR' };

export async function GET(req: Request) {
  const auth = await apiAuth();
  if ('error' in auth) return auth.error;
  const url = new URL(req.url);
  const patientId = url.searchParams.get('patientId');
  const type = url.searchParams.get('type');

  const rows = await db.select({
    id: documents.id, type: documents.type, number: documents.number,
    data: documents.data, createdAt: documents.createdAt,
    patient: { id: patients.id, name: patients.name, rmNumber: patients.rmNumber },
    doctor: { id: users.id, name: users.name },
  })
    .from(documents)
    .innerJoin(patients, eq(patients.id, documents.patientId))
    .innerJoin(users, eq(users.id, documents.doctorId))
    .where(and(
      eq(documents.branchId, auth.session.branchId),
      patientId ? eq(documents.patientId, patientId) : sql`true`,
      type ? eq(documents.type, type as 'sakit') : sql`true`,
    ))
    .orderBy(desc(documents.createdAt))
    .limit(100);
  return ok({ data: rows });
}

const Create = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  type: z.enum(['sakit', 'sehat', 'rujukan']),
  data: z.record(z.unknown()),
});

export async function POST(req: Request) {
  const auth = await apiAuth(['admin', 'dokter']);
  if ('error' in auth) return auth.error;
  const parsed = await parseJson(req, Create);
  if ('error' in parsed) return parsed.error;
  const d = parsed.data;
  const branchId = auth.session.branchId;

  const [p] = await db.select().from(patients)
    .where(and(eq(patients.id, d.patientId), eq(patients.branchId, branchId))).limit(1);
  if (!p) return err('NOT_FOUND', 'Pasien tidak ditemukan', 404);

  const year = new Date().getFullYear();
  const prefix = PREFIX[d.type];
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` })
    .from(documents)
    .where(and(eq(documents.branchId, branchId), ilike(documents.number, `${prefix}/${year}/%`)));
  const number = `${prefix}/${year}/${String(n + 1).padStart(4, '0')}`;

  const [row] = await db.insert(documents).values({
    branchId, patientId: d.patientId, doctorId: auth.session.sub,
    encounterId: d.encounterId || null, type: d.type, number, data: d.data,
  }).returning();

  await db.insert(auditLogs).values({
    actorId: auth.session.sub, action: 'create', entity: 'document', entityId: row.id,
    meta: { type: d.type, number },
  });
  return ok({ data: row }, 201);
}
