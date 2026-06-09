import crypto from 'node:crypto';
import { env } from '@/lib/env';

export function bpjsConfigured(): boolean {
  return Boolean(
    env.BPJS_PCARE_BASE_URL && env.BPJS_CONS_ID && env.BPJS_CONS_SECRET &&
    env.BPJS_PCARE_USER_KEY && env.BPJS_PCARE_USERNAME && env.BPJS_PCARE_PASSWORD,
  );
}

export interface PcareAuth {
  headers: Record<string, string>;
  timestamp: string;
}

/**
 * Header signature PCare (lihat PRD §19.2).
 * X-signature = base64(HMAC_SHA256("{consId}&{timestamp}", consSecret))
 */
export function pcareHeaders(): PcareAuth {
  const consId = env.BPJS_CONS_ID!;
  const secret = env.BPJS_CONS_SECRET!;
  const timestamp = Math.floor(Date.now() / 1000).toString(); // epoch detik UTC
  const signature = crypto.createHmac('sha256', secret)
    .update(`${consId}&${timestamp}`).digest('base64');
  const authz = Buffer.from(
    `${env.BPJS_PCARE_USERNAME}:${env.BPJS_PCARE_PASSWORD}:${env.BPJS_PCARE_APP_CODE}`,
  ).toString('base64');
  return {
    timestamp,
    headers: {
      'X-cons-id': consId,
      'X-timestamp': timestamp,
      'X-signature': signature,
      'X-authorization': `Basic ${authz}`,
      'user_key': env.BPJS_PCARE_USER_KEY!,
      Accept: 'application/json',
    },
  };
}
