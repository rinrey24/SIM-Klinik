import { z } from 'zod';
import { db } from '@/lib/db';
import { appointments, patients, users, auditLogs } from '@/drizzle/schema';
import { and, asc, eq, gte, lt } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { err, ok, parseJson } from '@/lib/api';

export async function GET(req: Request) {
  const auth = await apiAuth();
  if ('error' in auth) return auth.error;
  const url = new URL(req.url);
  const doctorId = url.searchParams.get('doctorId');
  const dateStr = url.searchParams.get('date'); // YYYY-MM-DD (opsional)

  const dateStart = dateStr ? new Date(dateStr + 'T00:00:00') : (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
  const dateEnd = new Date(dateStart); dateEnd.setDate(dateEnd.getDate() + 1);

  const rows = await db.select({
    id: appointments.id, scheduledAt: appointments.scheduledAt,
    note: appointments.note, status: appointments.status,
    doctor: { id: users.id, name: users.name },
    patient: { id: patients.id, name: patients.name, phone: patients.phone, rmNumber: patients.rmNumber },
  })
    .from(appointments)
    .innerJoin(users, eq(users.id, appointments.doctorId))
    .leftJoin(patients, eq(patients.id, appointments.patientId))
    .where(and(
      eq(appointments.branchId, auth.session.branchId),
      doctorId ? eq(appointments.doctorId, doctorId) : undefined,
      gte(appointments.scheduledAt, dateStart),
      lt(appointments.scheduledAt, dateEnd),
    ))
    .orderBy(asc(appointments.scheduledAt));

  return ok({ data: rows });
}

const Create = z.object({
  doctorId: z.string().uuid(),
  patientId: z.string().uuid().optional(),
  scheduledAt: z.string().min(1, 'Waktu janji wajib diisi'), // ISO
  note: z.string().optional().or(z.literal('')),
});

export async function POST(req: Request) {
  const auth = await apiAuth(['admin', 'pendaftaran']);
  if ('error' in auth) return auth.error;
  const parsed = await parseJson(req, Create);
  if ('error' in parsed) return parsed.error;
  const d = parsed.data;
  const at = new Date(d.scheduledAt);
  if (Number.isNaN(at.getTime())) return err('VALIDATION_ERROR', 'Waktu janji tidak valid', 422);

  const [row] = await db.insert(appointments).values({
    branchId: auth.session.branchId,
    doctorId: d.doctorId,
    patientId: d.patientId || null,
    scheduledAt: at,
    note: d.note || null,
    status: 'terjadwal',
  }).returning();

  await db.insert(auditLogs).values({
    actorId: auth.session.sub, action: 'create', entity: 'appointment', entityId: row.id,
  });
  return ok({ data: row }, 201);
}
