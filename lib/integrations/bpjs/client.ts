import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { pcareHeaders, bpjsConfigured } from './signature';
import { decryptPcare } from './crypto';
import { IntegrationNotConfigured } from '@/lib/integrations/satusehat/client';

export { bpjsConfigured };

const baseUrl = () => `${env.BPJS_PCARE_BASE_URL}/${env.BPJS_PCARE_SERVICE}`;

export interface PesertaResult {
  noKartu: string;
  nama: string;
  nik?: string;
  jnsPeserta?: string;
  status: 'AKTIF' | 'NON-AKTIF' | string;
  faskes?: string;
  raw?: unknown;
}

/**
 * Cek kepesertaan PCare berdasarkan No. Kartu BPJS atau NIK.
 * Endpoint PCare: /peserta/{noka} atau /peserta/nik/{nik}
 */
export async function cekPeserta(opts: { noKartu?: string; nik?: string }): Promise<PesertaResult> {
  if (!bpjsConfigured()) throw new IntegrationNotConfigured('BPJS PCare');
  const { noKartu, nik } = opts;
  if (!noKartu && !nik) throw new Error('Wajib isi No. Kartu BPJS atau NIK');

  const path = noKartu ? `peserta/${encodeURIComponent(noKartu)}` : `peserta/nik/${encodeURIComponent(nik!)}`;
  const auth = pcareHeaders();
  const res = await fetch(`${baseUrl()}/${path}`, { headers: auth.headers });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`BPJS PCare error ${res.status}: ${text.slice(0, 200)}`);
  }

  // Respons BPJS: { metaData: { code, message }, response: "<encrypted base64>" }
  let parsed: { metaData?: { code?: string | number; message?: string }; response?: string } = {};
  try { parsed = JSON.parse(text); } catch { throw new Error('Respons BPJS bukan JSON'); }

  const code = String(parsed.metaData?.code ?? '');
  if (code !== '200' && code !== '1') {
    throw new Error(parsed.metaData?.message || `BPJS menolak: ${code}`);
  }

  let payload: Record<string, unknown> = {};
  if (typeof parsed.response === 'string' && parsed.response.length > 0) {
    try {
      payload = JSON.parse(decryptPcare(parsed.response, auth.timestamp)) as Record<string, unknown>;
    } catch (e) {
      logger.warn({ err: (e as Error).message }, 'Dekripsi BPJS gagal');
      throw new Error('Gagal mendekripsi respons BPJS');
    }
  } else if (parsed.response && typeof parsed.response === 'object') {
    payload = parsed.response as Record<string, unknown>;
  }

  // Normalisasi field umum PCare
  const peserta = (payload.peserta as Record<string, unknown>) ?? payload;
  return {
    noKartu: String(peserta.noKartu ?? noKartu ?? ''),
    nama: String(peserta.nama ?? ''),
    nik: peserta.nik ? String(peserta.nik) : nik,
    jnsPeserta: peserta.jnsPeserta ? String((peserta.jnsPeserta as Record<string, unknown>).nmJnsPeserta ?? peserta.jnsPeserta) : undefined,
    status: String((peserta.statusPeserta as Record<string, unknown>)?.keterangan ?? peserta.status ?? 'AKTIF'),
    faskes: peserta.kdProviderPst ? String((peserta.kdProviderPst as Record<string, unknown>).nmProvider ?? '') : undefined,
    raw: payload,
  };
}
