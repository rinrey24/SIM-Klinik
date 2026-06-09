import { apiAuth } from '@/lib/auth/rbac';
import { err, ok } from '@/lib/api';
import { db } from '@/lib/db';
import { auditLogs } from '@/drizzle/schema';
import { cekPeserta } from '@/lib/integrations/bpjs/client';
import { IntegrationNotConfigured } from '@/lib/integrations/satusehat/client';

export async function GET(req: Request) {
  const auth = await apiAuth(['admin', 'pendaftaran', 'kasir']);
  if ('error' in auth) return auth.error;
  const url = new URL(req.url);
  const noKartu = url.searchParams.get('noKartu') ?? undefined;
  const nik = url.searchParams.get('nik') ?? undefined;
  if (!noKartu && !nik) return err('VALIDATION_ERROR', 'Sertakan noKartu atau nik', 422);

  try {
    const peserta = await cekPeserta({ noKartu, nik });
    await db.insert(auditLogs).values({
      actorId: auth.session.sub, action: 'bpjs_cek_peserta', entity: 'patient', entityId: null,
      meta: { noKartu: noKartu ?? null, status: peserta.status },
    });
    return ok({ data: peserta });
  } catch (e) {
    if (e instanceof IntegrationNotConfigured) {
      return err('NOT_CONFIGURED', 'Integrasi BPJS belum dikonfigurasi. Atur kredensial di Pengaturan/.env.', 503);
    }
    return err('BPJS_ERROR', (e as Error).message, 502);
  }
}
