import { z } from 'zod';
import { db } from '@/lib/db';
import { drugs, stockMovements, auditLogs } from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { err, ok, parseJson } from '@/lib/api';

const Schema = z.object({
  qty: z.coerce.number().int().refine((n) => n !== 0, 'Qty tidak boleh 0'),
  reason: z.enum(['restock', 'adjustment', 'expired', 'koreksi']).default('restock'),
  expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await apiAuth(['admin', 'apoteker']);
  if ('error' in auth) return auth.error;
  const { id } = await ctx.params;
  const parsed = await parseJson(req, Schema);
  if ('error' in parsed) return parsed.error;
  const { qty, reason, expiry } = parsed.data;
  const userId = auth.session.sub;

  try {
    const row = await db.transaction(async (tx) => {
      const [d] = await tx.select().from(drugs)
        .where(and(eq(drugs.id, id), eq(drugs.branchId, auth.session.branchId)))
        .for('update');
      if (!d) throw new Error('NOT_FOUND');
      const newStock = d.stock + qty;
      if (newStock < 0) throw new Error('NEGATIVE');
      const [updated] = await tx.update(drugs)
        .set({ stock: newStock, ...(expiry ? { expiry } : {}) })
        .where(eq(drugs.id, id)).returning();
      await tx.insert(stockMovements).values({
        drugId: id, qtyDelta: qty, reason, balanceAfter: newStock, createdBy: userId,
      });
      await tx.insert(auditLogs).values({
        actorId: userId, action: 'stock_movement', entity: 'drug', entityId: id, meta: { qty, reason, balanceAfter: newStock },
      });
      return updated;
    });
    return ok({ data: row });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'NOT_FOUND') return err('NOT_FOUND', 'Obat tidak ditemukan', 404);
    if (msg === 'NEGATIVE') return err('VALIDATION_ERROR', 'Stok tidak boleh menjadi negatif', 422);
    throw e;
  }
}
