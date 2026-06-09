import { db } from '@/lib/db';
import { encounters, patients, users, vitalSigns, medicalRecords } from '@/drizzle/schema';
import { and, desc, eq } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { err, ok } from '@/lib/api';

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await apiAuth();
  if ('error' in auth) return auth.error;
  const { id } = await ctx.params;

  const [enc] = await db.select({
    id: encounters.id, queueNo: encounters.queueNo, status: encounters.status,
    complaint: encounters.complaint, arrivedAt: encounters.arrivedAt,
    startedAt: encounters.startedAt, finishedAt: encounters.finishedAt,
    syncStatus: encounters.syncStatus,
    patient: { id: patients.id, name: patients.name, rmNumber: patients.rmNumber, nik: patients.nik, sex: patients.sex, dob: patients.dob, phone: patients.phone, penjamin: patients.penjamin, bpjsNumber: patients.bpjsNumber, allergies: patients.allergies },
    doctor: { id: users.id, name: users.name, sip: users.sip },
  })
    .from(encounters)
    .innerJoin(patients, eq(patients.id, encounters.patientId))
    .innerJoin(users, eq(users.id, encounters.doctorId))
    .where(and(eq(encounters.id, id), eq(encounters.branchId, auth.session.branchId)))
    .limit(1);

  if (!enc) return err('NOT_FOUND', 'Kunjungan tidak ditemukan', 404);

  // vital & history independen → paralel
  const [vitalRows, history] = await Promise.all([
    db.select().from(vitalSigns).where(eq(vitalSigns.encounterId, id)).orderBy(desc(vitalSigns.recordedAt)).limit(1),
    db.select({
      id: encounters.id, queueNo: encounters.queueNo, finishedAt: encounters.finishedAt,
      arrivedAt: encounters.arrivedAt, status: encounters.status, syncStatus: encounters.syncStatus,
      doctorName: users.name,
      mrId: medicalRecords.id, s: medicalRecords.s, o: medicalRecords.o, a: medicalRecords.a, p: medicalRecords.p,
    })
      .from(encounters)
      .innerJoin(users, eq(users.id, encounters.doctorId))
      .leftJoin(medicalRecords, eq(medicalRecords.encounterId, encounters.id))
      .where(and(
        eq(encounters.patientId, enc.patient.id),
        eq(encounters.branchId, auth.session.branchId),
        eq(encounters.status, 'selesai'),
      ))
      .orderBy(desc(encounters.finishedAt))
      .limit(10),
  ]);

  return ok({ data: { ...enc, vital: vitalRows[0] ?? null, history } });
}
