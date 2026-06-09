import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

export class IntegrationNotConfigured extends Error {
  constructor(provider: string) {
    super(`Integrasi ${provider} belum dikonfigurasi (kredensial kosong)`);
    this.name = 'IntegrationNotConfigured';
  }
}

export function satusehatConfigured(): boolean {
  return Boolean(env.SATUSEHAT_BASE_URL && env.SATUSEHAT_AUTH_URL && env.SATUSEHAT_CLIENT_ID && env.SATUSEHAT_CLIENT_SECRET && env.SATUSEHAT_ORG_ID);
}

let cached: { token: string; exp: number } | null = null;

export async function getToken(): Promise<string> {
  if (!satusehatConfigured()) throw new IntegrationNotConfigured('SATUSEHAT');
  if (cached && Date.now() < cached.exp - 60_000) return cached.token;

  const res = await fetch(`${env.SATUSEHAT_AUTH_URL}?grant_type=client_credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.SATUSEHAT_CLIENT_ID!,
      client_secret: env.SATUSEHAT_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SATUSEHAT auth gagal: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

const FHIR_BASE = () => `${env.SATUSEHAT_BASE_URL}/fhir-r4/v1`;

export async function fhirPost<T = unknown>(resource: string, body: unknown): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${FHIR_BASE()}/${resource}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SATUSEHAT POST ${resource} gagal: ${res.status} ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export async function fhirGet<T = unknown>(path: string): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${FHIR_BASE()}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SATUSEHAT GET ${path} gagal: ${res.status} ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Resolusi IHS number pasien berdasarkan NIK.
 * SATUSEHAT: GET /Patient?identifier=https://fhir.kemkes.go.id/id/nik|{nik}
 */
export async function resolveIhsByNik(nik: string): Promise<string | null> {
  try {
    const bundle = await fhirGet<{ entry?: { resource?: { id?: string } }[] }>(
      `Patient?identifier=https://fhir.kemkes.go.id/id/nik|${encodeURIComponent(nik)}`,
    );
    return bundle.entry?.[0]?.resource?.id ?? null;
  } catch (e) {
    logger.warn({ err: (e as Error).message }, 'resolveIhsByNik gagal');
    return null;
  }
}
