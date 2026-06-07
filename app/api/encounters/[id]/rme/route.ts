import { z } from 'zod';
import { db } from '@/lib/db';
import { encounters, medicalRecords, diagnoses, procedures, prescriptions, prescriptionItems, tariffs, drugs, outboxJobs, auditLogs, bills, billItems } from '@/drizzle/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { err, ok, parseJson } from '@/lib/api';
import crypto from 'node:crypto';

const Schema = z.object({
  soap: z.object({
    s: z.string().optional().default(''),
    o: z.string().optional().default(''),
    a: z.string().min(1, 'Assessment wajib diisi'),
    p: z.string().optional().default(''),
  }),
  diagnoses: z.array(z.object({
    icd10Code: z.string().min(1),
    icd10Name: z.string().min(1),
    isPrimary: z.boolean().optional().default(false),
  })).min(1, 'Minimal 1 diagnosis'),
  procedureTariffIds: z.array(z.string().uuid()).default([]),
  prescription: z.object({
    items: z.array(z.object({
      drugId: z.string().uuid(),
      qty: z.number().int().positive(),
      signa: z.string().min(1, 'Signa wajib diisi'),
    })),
  }).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await apiAuth(['admin', 'dokter']);
  if ('error' in auth) return auth.error;
  const { id } = await ctx.params;
  const parsed = await parseJson(req, Schema);
  if ('error' in parsed) return parsed.error;
  const body = parsed.data;
  const userId = auth.session.sub;

  const [enc] = await db.select().from(encounters)
    .where(and(eq(encounters.id, id), eq(encounters.branchId, auth.session.branchId))).limit(1);
  if (!enc) return err('NOT_FOUND', 'Kunjungan tidak ditemukan', 404);
  if (enc.status === 'selesai') return err('CONFLICT', 'Kunjungan sudah selesai', 409);

  // Pastikan ada satu primary
  if (!body.diagnoses.some((d) => d.isPrimary)) body.diagnoses[0].isPrimary = true;

  const result = await db.transaction(async (tx) => {
    const [mr] = await tx.insert(medicalRecords).values({
      encounterId: id, patientId: enc.patientId, doctorId: enc.doctorId,
      s: body.soap.s, o: body.soap.o, a: body.soap.a, p: body.soap.p,
    }).returning();

    await tx.insert(diagnoses).values(body.diagnoses.map((d) => ({
      medicalRecordId: mr.id, icd10Code: d.icd10Code, icd10Name: d.icd10Name, isPrimary: d.isPrimary,
    })));

    if (body.procedureTariffIds.length) {
      const trs = await tx.select().from(tariffs).where(inArray(tariffs.id, body.procedureTariffIds));
      if (trs.length) {
        await tx.insert(procedures).values(trs.map((t) => ({
          encounterId: id, tariffId: t.id, qty: 1, priceSnapshot: t.price,
        })));
      }
    }

    let rxId: string | null = null;
    if (body.prescription && body.prescription.items.length) {
      const [rx] = await tx.insert(prescriptions).values({
        encounterId: id, patientId: enc.patientId, doctorId: enc.doctorId, status: 'masuk',
      }).returning();
      rxId = rx.id;
      const items = body.prescription.items;
      const drs = await tx.select().from(drugs).where(inArray(drugs.id, items.map((i) => i.drugId)));
      const priceOf = (drugId: string) => drs.find((d) => d.id === drugId)?.price ?? '0';
      await tx.insert(prescriptionItems).values(items.map((i) => ({
        prescriptionId: rx.id, drugId: i.drugId, qty: i.qty, signa: i.signa, priceSnapshot: priceOf(i.drugId),
      })));
    }

    // Auto-create draft bill: jasa default (konsultasi + administrasi) + tindakan terpilih
    const jasaTariffs = await tx.select().from(tariffs)
      .where(and(eq(tariffs.branchId, enc.branchId), eq(tariffs.type, 'jasa')));
    const tindakanTariffs = body.procedureTariffIds.length
      ? await tx.select().from(tariffs).where(inArray(tariffs.id, body.procedureTariffIds))
      : [];
    const itemsRow: { label: string; qty: number; price: string; type: 'jasa' | 'tindakan' | 'obat' }[] = [
      ...jasaTariffs.map((t) => ({ label: t.label, qty: 1, price: t.price, type: 'jasa' as const })),
      ...tindakanTariffs.map((t) => ({ label: t.label, qty: 1, price: t.price, type: 'tindakan' as const })),
    ];
    const total = itemsRow.reduce((s, i) => s + Number(i.price) * i.qty, 0);

    const [bill] = await tx.insert(bills).values({
      branchId: enc.branchId, encounterId: id, patientId: enc.patientId,
      status: 'belum', total: total.toFixed(2),
    }).returning();

    if (itemsRow.length) {
      await tx.insert(billItems).values(itemsRow.map((i) => ({
        billId: bill.id, label: i.label, qty: i.qty, price: i.price, type: i.type,
      })));
    }

    await tx.update(encounters)
      .set({ status: 'selesai', finishedAt: new Date(), syncStatus: 'menunggu' })
      .where(eq(encounters.id, id));

    // Enqueue SATUSEHAT submission via outbox (worker akan ambil)
    const idem = `satusehat:encounter:${id}`;
    await tx.insert(outboxJobs).values({
      kind: 'satusehat',
      payload: { encounterId: id, medicalRecordId: mr.id, prescriptionId: rxId },
      idempotencyKey: idem,
      status: 'menunggu',
    }).onConflictDoNothing();

    await tx.insert(auditLogs).values({
      actorId: userId, action: 'close_encounter', entity: 'encounter', entityId: id,
      meta: { medicalRecordId: mr.id, prescriptionId: rxId },
    });

    return { medicalRecordId: mr.id, prescriptionId: rxId };
  });

  return ok({ data: result }, 201);
}
