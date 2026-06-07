import { db } from '@/lib/db';
import { drugs } from '@/drizzle/schema';
import { and, eq, ilike } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { ok } from '@/lib/api';

export async function GET(req: Request) {
  const auth = await apiAuth();
  if ('error' in auth) return auth.error;
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const rows = await db.select().from(drugs).where(and(
    eq(drugs.branchId, auth.session.branchId),
    q ? ilike(drugs.name, `%${q}%`) : undefined,
  )).limit(50);
  return ok({ data: rows });
}
