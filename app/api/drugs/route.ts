import { z } from 'zod';
import { db } from '@/lib/db';
import { drugs, stockMovements, auditLogs } from '@/drizzle/schema';
import { and, asc, eq, ilike } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { ok, parseJson } from '@/lib/api';

export async function GET(req: Request) {
  const auth = await apiAuth();
  if ('error' in auth) return auth.error;
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const rows = await db.select().from(drugs).where(and(
    eq(drugs.branchId, auth.session.branchId),
    q ? ilike(drugs.name, `%${q}%`) : undefined,
  )).orderBy(asc(drugs.name)).limit(200);
  return ok({ data: rows });
}

const Create = z.object({
  name: z.string().min(2, 'Nama obat minimal 2 karakter'),
  kind: z.string().min(1, 'Jenis wajib diisi'),
  stock: z.coerce.number().int().min(0).default(0),
  minStock: z.coerce.number().int().min(0).default(0),
  price: z.coerce.number().min(0),
  expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD').optional().or(z.literal('')),
  satusehatKfaCode: z.string().optional().or(z.literal('')),
});

export async function POST(req: Request) {
  const auth = await apiAuth(['admin', 'apoteker']);
  if ('error' in auth) return auth.error;
  const parsed = await parseJson(req, Create);
  if ('error' in parsed) return parsed.error;
  const d = parsed.data;
  const userId = auth.session.sub;

  const row = await db.transaction(async (tx) => {
    const [created] = await tx.insert(drugs).values({
      branchId: auth.session.branchId,
      name: d.name, kind: d.kind, stock: d.stock, minStock: d.minStock,
      price: d.price.toFixed(2), expiry: d.expiry || null,
      satusehatKfaCode: d.satusehatKfaCode || null,
    }).returning();
    if (d.stock > 0) {
      await tx.insert(stockMovements).values({
        drugId: created.id, qtyDelta: d.stock, reason: 'initial', balanceAfter: d.stock, createdBy: userId,
      });
    }
    await tx.insert(auditLogs).values({
      actorId: userId, action: 'create', entity: 'drug', entityId: created.id, meta: { name: d.name },
    });
    return created;
  });

  return ok({ data: row }, 201);
}
