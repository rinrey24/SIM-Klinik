import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  TOKEN_COOKIE, REFRESH_COOKIE, ACCESS_MAX_AGE, REFRESH_MAX_AGE,
  signAccessToken, signRefreshToken, verifyAccessToken,
  type AccessClaims,
} from './jwt';
import { ROLE_HOMES } from './rbac';
import { db } from '@/lib/db';
import { sessions, users } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export async function createSessionFor(user: { id: string; role: AccessClaims['role']; branchId: string; name: string }) {
  const h = await headers();
  const ua = h.get('user-agent') ?? null;
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

  const [session] = await db.insert(sessions).values({
    userId: user.id,
    refreshTokenHash: 'pending',
    userAgent: ua,
    ip,
    expiresAt: new Date(Date.now() + REFRESH_MAX_AGE * 1000),
  }).returning({ id: sessions.id });

  const access = await signAccessToken({ sub: user.id, role: user.role, branchId: user.branchId, name: user.name });
  const refresh = await signRefreshToken(user.id, session.id);

  await db.update(sessions).set({ refreshTokenHash: hash(refresh) }).where(eq(sessions.id, session.id));

  const jar = await cookies();
  const secure = process.env.NODE_ENV === 'production';
  jar.set(TOKEN_COOKIE, access, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: ACCESS_MAX_AGE });
  jar.set(REFRESH_COOKIE, refresh, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: REFRESH_MAX_AGE });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(TOKEN_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

export async function getSession(): Promise<AccessClaims | null> {
  const jar = await cookies();
  const t = jar.get(TOKEN_COOKIE)?.value;
  if (!t) return null;
  return verifyAccessToken(t);
}

export async function requireAuth(): Promise<AccessClaims> {
  const s = await getSession();
  if (!s) redirect('/login');
  return s;
}

export async function requireRole(roles: AccessClaims['role'][]): Promise<AccessClaims> {
  const s = await requireAuth();
  if (!roles.includes(s.role)) redirect(ROLE_HOMES[s.role]);
  return s;
}

export async function getCurrentUser() {
  const s = await getSession();
  if (!s) return null;
  const [u] = await db.select().from(users).where(eq(users.id, s.sub)).limit(1);
  return u ?? null;
}
