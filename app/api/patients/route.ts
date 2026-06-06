import { z } from 'zod';
import { db } from '@/lib/db';
import { patients, auditLogs } from '@/drizzle/schema';
import { and, eq, or, ilike, desc, sql } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { err, ok, parseJson } from '@/lib/api';

export async function GET(req: Request) {
  const auth = await apiAuth();
  if ('error' in auth) return auth.error;
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 10)));
  const branchId = auth.session.branchId;

  const where = q
    ? and(eq(patients.branchId, branchId), or(
        ilike(patients.name, `%${q}%`),
        ilike(patients.nik, `%${q}%`),
        ilike(patients.rmNumber, `%${q}%`),
        ilike(patients.phone, `%${q}%`),
      ))
    : eq(patients.branchId, branchId);

  const rows = await db.select().from(patients).where(where).orderBy(desc(patients.createdAt)).limit(limit);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(patients).where(eq(patients.branchId, branchId));
  return ok({ data: rows, total });
}

const Create = z.object({
  name: z.string().min(3, 'Nama minimal 3 karakter'),
  nik: z.string().regex(/^\d{16}$/, 'NIK harus 16 digit').optional().or(z.literal('')),
  sex: z.enum(['L', 'P']),
  dob: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Format DD/MM/YYYY').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  penjamin: z.enum(['BPJS', 'Umum', 'Asuransi']).default('Umum'),
  bpjsNumber: z.string().optional().or(z.literal('')),
  allergies: z.string().optional().or(z.literal('')),
});

function parseDDMMYYYY(s: string): string | null {
  if (!s) return null;
  const [d, m, y] = s.split('/').map(Number);
  if (!d || !m || !y) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export async function POST(req: Request) {
  const auth = await apiAuth(['admin', 'pendaftaran', 'perawat']);
  if ('error' in auth) return auth.error;
  const parsed = await parseJson(req, Create);
  if ('error' in parsed) return parsed.error;
  const d = parsed.data;
  if (d.penjamin === 'BPJS' && !d.bpjsNumber) return err('VALIDATION_ERROR', 'No. BPJS wajib diisi untuk peserta BPJS', 422);
  const branchId = auth.session.branchId;

  // Generate RM-XXXXXX
  const result = await db.execute(
    sql`SELECT coalesce(max(substring(rm_number from 4)::int), 0) + 1 AS next FROM patients WHERE branch_id = ${branchId}`,
  );
  const next = Number((result as unknown as { next: number }[])[0]?.next ?? 1);
  const rmNumber = `RM-${String(next).padStart(6, '0')}`;

  const [row] = await db.insert(patients).values({
    branchId, rmNumber,
    name: d.name,
    nik: d.nik || null,
    sex: d.sex,
    dob: parseDDMMYYYY(d.dob ?? ''),
    phone: d.phone || null,
    address: d.address || null,
    penjamin: d.penjamin,
    bpjsNumber: d.bpjsNumber || null,
    allergies: d.allergies || null,
  }).returning();

  await db.insert(auditLogs).values({
    actorId: auth.session.sub, action: 'create', entity: 'patient', entityId: row.id,
    meta: { rmNumber, penjamin: d.penjamin },
  });
  return ok({ data: row }, 201);
}
