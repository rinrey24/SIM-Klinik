import { db } from '@/lib/db';
import { tariffs } from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { ok } from '@/lib/api';

export async function GET(req: Request) {
  const auth = await apiAuth();
  if ('error' in auth) return auth.error;
  const url = new URL(req.url);
  const type = url.searchParams.get('type') as 'jasa' | 'tindakan' | null;
  const rows = await db.select().from(tariffs).where(and(
    eq(tariffs.branchId, auth.session.branchId),
    type ? eq(tariffs.type, type) : undefined,
  ));
  return ok({ data: rows });
}
