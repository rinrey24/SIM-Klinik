import { z } from 'zod';
import { db } from '@/lib/db';
import { encounters, vitalSigns, auditLogs } from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { err, ok, parseJson } from '@/lib/api';

const Schema = z.object({
  td: z.string().optional().or(z.literal('')),
  nadi: z.coerce.number().int().min(0).max(300).optional().or(z.literal('')),
  suhu: z.coerce.number().min(0).max(50).optional().or(z.literal('')),
  rr: z.coerce.number().int().min(0).max(120).optional().or(z.literal('')),
  spo2: z.coerce.number().int().min(0).max(100).optional().or(z.literal('')),
  bb: z.coerce.number().min(0).max(500).optional().or(z.literal('')),
  tb: z.coerce.number().min(0).max(300).optional().or(z.literal('')),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await apiAuth(['admin', 'dokter', 'perawat']);
  if ('error' in auth) return auth.error;
  const { id } = await ctx.params;
  const parsed = await parseJson(req, Schema);
  if ('error' in parsed) return parsed.error;

  const [enc] = await db.select().from(encounters)
    .where(and(eq(encounters.id, id), eq(encounters.branchId, auth.session.branchId))).limit(1);
  if (!enc) return err('NOT_FOUND', 'Kunjungan tidak ditemukan', 404);

  const d = parsed.data;
  const num = (v: unknown) => (v === '' || v == null ? null : String(v));
  const [row] = await db.insert(vitalSigns).values({
    encounterId: id,
    td: d.td || null,
    nadi: d.nadi === '' || d.nadi == null ? null : Number(d.nadi),
    suhu: num(d.suhu),
    rr: d.rr === '' || d.rr == null ? null : Number(d.rr),
    spo2: d.spo2 === '' || d.spo2 == null ? null : Number(d.spo2),
    bb: num(d.bb), tb: num(d.tb),
    recordedBy: auth.session.sub,
  }).returning();

  await db.insert(auditLogs).values({
    actorId: auth.session.sub, action: 'create', entity: 'vital_sign', entityId: row.id,
    meta: { encounterId: id },
  });
  return ok({ data: row }, 201);
}
