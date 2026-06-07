import { db } from '@/lib/db';
import { icd10Ref } from '@/drizzle/schema';
import { or, ilike } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { ok } from '@/lib/api';

export async function GET(req: Request) {
  const auth = await apiAuth();
  if ('error' in auth) return auth.error;
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();

  const rows = await db.select().from(icd10Ref)
    .where(q ? or(ilike(icd10Ref.code, `%${q}%`), ilike(icd10Ref.name, `%${q}%`)) : undefined)
    .limit(20);
  return ok({ data: rows });
}
