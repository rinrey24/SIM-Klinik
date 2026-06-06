import { db } from '@/lib/db';
import { users } from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { apiAuth } from '@/lib/auth/rbac';
import { ok } from '@/lib/api';

export async function GET() {
  const auth = await apiAuth();
  if ('error' in auth) return auth.error;
  const rows = await db.select({ id: users.id, name: users.name, sip: users.sip })
    .from(users)
    .where(and(eq(users.branchId, auth.session.branchId), eq(users.role, 'dokter'), eq(users.active, true)));
  return ok({ data: rows });
}
