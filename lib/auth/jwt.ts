import 'server-only';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { env } from '@/lib/env';

const ACCESS_TTL = 60 * 15;
const REFRESH_TTL = 60 * 60 * 24 * 14;

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

export interface AccessClaims extends JWTPayload {
  sub: string;
  role: 'admin' | 'pendaftaran' | 'dokter' | 'perawat' | 'apoteker' | 'kasir';
  branchId: string;
  name: string;
}

export async function signAccessToken(claims: Omit<AccessClaims, 'iat' | 'exp'>) {
  return new SignJWT(claims as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL}s`)
    .sign(accessSecret);
}

export async function signRefreshToken(userId: string, sessionId: string) {
  return new SignJWT({ sub: userId, sid: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TTL}s`)
    .sign(refreshSecret);
}

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, accessSecret);
    return payload as AccessClaims;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, refreshSecret);
    return payload as { sub: string; sid: string } & JWTPayload;
  } catch {
    return null;
  }
}

export const TOKEN_COOKIE = 'sk_at';
export const REFRESH_COOKIE = 'sk_rt';
export const ACCESS_MAX_AGE = ACCESS_TTL;
export const REFRESH_MAX_AGE = REFRESH_TTL;
