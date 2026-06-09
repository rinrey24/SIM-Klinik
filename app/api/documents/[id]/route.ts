import { db } from '@/lib/db';
import { documents, patients, users, branches } from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { err, ok } from '@/lib/api';

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await apiAuth();
  if ('error' in auth) return auth.error;
  const { id } = await ctx.params;

  const [row] = await db.select({
    id: documents.id, type: documents.type, number: documents.number,
    data: documents.data, createdAt: documents.createdAt,
    patient: {
      id: patients.id, name: patients.name, rmNumber: patients.rmNumber, nik: patients.nik,
      sex: patients.sex, dob: patients.dob, address: patients.address,
    },
    doctor: { id: users.id, name: users.name, sip: users.sip },
    clinic: { name: branches.name, address: branches.address, phone: branches.phone, accentColor: branches.accentColor },
  })
    .from(documents)
    .innerJoin(patients, eq(patients.id, documents.patientId))
    .innerJoin(users, eq(users.id, documents.doctorId))
    .innerJoin(branches, eq(branches.id, documents.branchId))
    .where(and(eq(documents.id, id), eq(documents.branchId, auth.session.branchId)))
    .limit(1);

  if (!row) return err('NOT_FOUND', 'Dokumen tidak ditemukan', 404);
  return ok({ data: row });
}
