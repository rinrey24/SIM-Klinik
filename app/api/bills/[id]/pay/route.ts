import { z } from 'zod';
import { db } from '@/lib/db';
import { bills, patients, auditLogs } from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { err, ok, parseJson } from '@/lib/api';
import { enqueueOutbox } from '@/lib/queue/enqueue';
import { formatRp } from '@/lib/utils';

const Schema = z.object({
  method: z.enum(['tunai', 'qris', 'kartu', 'bpjs']),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await apiAuth(['admin', 'kasir']);
  if ('error' in auth) return auth.error;
  const { id } = await ctx.params;
  const parsed = await parseJson(req, Schema);
  if ('error' in parsed) return parsed.error;

  const [b] = await db.select().from(bills)
    .where(and(eq(bills.id, id), eq(bills.branchId, auth.session.branchId))).limit(1);
  if (!b) return err('NOT_FOUND', 'Tagihan tidak ditemukan', 404);
  if (b.status === 'lunas') return err('CONFLICT', 'Tagihan sudah lunas', 409);
  if (b.status === 'batal') return err('CONFLICT', 'Tagihan telah dibatalkan', 409);

  const [row] = await db.update(bills)
    .set({ status: 'lunas', payMethod: parsed.data.method, paidAt: new Date() })
    .where(eq(bills.id, id)).returning();

  await db.insert(auditLogs).values({
    actorId: auth.session.sub, action: 'pay_bill', entity: 'bill', entityId: id,
    meta: { method: parsed.data.method, total: b.total },
  });

  // Nota digital via WhatsApp (asinkron via outbox) bila pasien punya nomor HP
  const [p] = await db.select({ name: patients.name, phone: patients.phone })
    .from(patients).where(eq(patients.id, b.patientId)).limit(1);
  if (p?.phone) {
    const dibayar = parsed.data.method === 'bpjs' ? 0 : Number(b.total);
    const body = [
      `*Klinik Sehat Bersama*`,
      `Nota pembayaran INV/${id.slice(-6).toUpperCase()}`,
      `Pasien: ${p.name}`,
      `Total: ${formatRp(dibayar)}`,
      `Metode: ${parsed.data.method.toUpperCase()}`,
      `Status: LUNAS`,
      ``,
      `Terima kasih atas kunjungan Anda. Semoga lekas sehat. 🙏`,
    ].join('\n');
    await enqueueOutbox('whatsapp', `wa:nota:${id}`, { to: p.phone, body });
  }

  return ok({ data: row });
}
