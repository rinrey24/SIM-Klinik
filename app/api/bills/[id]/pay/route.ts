import { z } from 'zod';
import { db } from '@/lib/db';
import { bills, auditLogs } from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { err, ok, parseJson } from '@/lib/api';

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

  return ok({ data: row });
}
