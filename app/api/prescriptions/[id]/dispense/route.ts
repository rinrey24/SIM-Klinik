import { db } from '@/lib/db';
import { prescriptions, prescriptionItems, drugs, stockMovements, bills, billItems, encounters, auditLogs } from '@/drizzle/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { err, ok } from '@/lib/api';

export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await apiAuth(['admin', 'apoteker']);
  if ('error' in auth) return auth.error;
  const { id } = await ctx.params;
  const userId = auth.session.sub;

  try {
    const result = await db.transaction(async (tx) => {
      const [rx] = await tx.select().from(prescriptions).where(eq(prescriptions.id, id)).limit(1);
      if (!rx) throw new Error('NOT_FOUND');
      if (rx.status === 'diserahkan') throw new Error('ALREADY');
      if (rx.status === 'batal') throw new Error('CANCELLED');

      const [enc] = await tx.select().from(encounters).where(eq(encounters.id, rx.encounterId)).limit(1);
      if (!enc || enc.branchId !== auth.session.branchId) throw new Error('NOT_FOUND');

      const items = await tx.select().from(prescriptionItems).where(eq(prescriptionItems.prescriptionId, id));

      // Lock & decrement drug stocks
      for (const it of items) {
        const [d] = await tx.select().from(drugs)
          .where(eq(drugs.id, it.drugId))
          .for('update');
        if (!d) throw new Error('DRUG_NOT_FOUND');
        if (d.stock < it.qty) throw new Error(`INSUFFICIENT_STOCK:${d.name}:${d.stock}`);
        const newStock = d.stock - it.qty;
        await tx.update(drugs).set({ stock: newStock }).where(eq(drugs.id, d.id));
        await tx.insert(stockMovements).values({
          drugId: d.id, qtyDelta: -it.qty, reason: 'dispense',
          refType: 'prescription', refId: id, balanceAfter: newStock, createdBy: userId,
        });
      }

      // Append bill items (obat) ke bill encounter (kalau ada)
      const [bill] = await tx.select().from(bills).where(eq(bills.encounterId, rx.encounterId)).limit(1);
      if (bill && items.length) {
        const drugMap = new Map<string, { name: string; price: string }>();
        const drs = await tx.select({ id: drugs.id, name: drugs.name, price: drugs.price }).from(drugs)
          .where(inArray(drugs.id, items.map((i) => i.drugId)));
        for (const d of drs) drugMap.set(d.id, { name: d.name, price: d.price });
        const newItems = items.map((it) => ({
          billId: bill.id,
          label: drugMap.get(it.drugId)?.name ?? 'Obat',
          qty: it.qty,
          price: it.priceSnapshot,
          type: 'obat' as const,
        }));
        await tx.insert(billItems).values(newItems);
        const addTotal = newItems.reduce((s, i) => s + Number(i.price) * i.qty, 0);
        await tx.update(bills)
          .set({ total: sql`${bills.total} + ${addTotal.toFixed(2)}` })
          .where(eq(bills.id, bill.id));
      }

      const [updated] = await tx.update(prescriptions)
        .set({ status: 'diserahkan', dispensedAt: new Date(), dispensedBy: userId })
        .where(eq(prescriptions.id, id))
        .returning();

      await tx.insert(auditLogs).values({
        actorId: userId, action: 'dispense', entity: 'prescription', entityId: id,
        meta: { itemCount: items.length, billId: bill?.id ?? null },
      });

      return updated;
    });

    return ok({ data: result });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'NOT_FOUND') return err('NOT_FOUND', 'Resep tidak ditemukan', 404);
    if (msg === 'ALREADY') return err('CONFLICT', 'Resep sudah diserahkan', 409);
    if (msg === 'CANCELLED') return err('CONFLICT', 'Resep telah dibatalkan', 409);
    if (msg.startsWith('INSUFFICIENT_STOCK')) {
      const [, name, stock] = msg.split(':');
      return err('INSUFFICIENT_STOCK', `Stok ${name} tidak cukup (tersisa ${stock})`, 409);
    }
    throw e;
  }
}
