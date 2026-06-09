import { eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db/client';
import { logger } from '@/lib/logger';
import { submitEncounterToSatusehat } from '@/lib/integrations/satusehat';
import { IntegrationNotConfigured } from '@/lib/integrations/satusehat/client';
import { sendWhatsApp } from '@/lib/integrations/whatsapp/client';

const { outboxJobs, encounters } = schema;

const MAX_ATTEMPTS = 6;
const NOT_CONFIGURED_RETRY_SEC = 3600; // tunda 1 jam bila kredensial belum diatur
const backoffSec = (attempts: number) => Math.min(30 * 2 ** attempts, 3600);

type Job = typeof outboxJobs.$inferSelect;

async function handle(job: Job): Promise<void> {
  const payload = job.payload as Record<string, unknown>;
  switch (job.kind) {
    case 'satusehat':
      await submitEncounterToSatusehat(String(payload.encounterId));
      return;
    case 'whatsapp':
      await sendWhatsApp({ to: String(payload.to), body: String(payload.body) });
      return;
    case 'bpjs':
    case 'email':
      logger.info({ kind: job.kind }, 'Outbox kind belum diimplementasi — dilewati');
      return;
    default:
      throw new Error(`Kind tidak dikenal: ${job.kind}`);
  }
}

/**
 * Klaim & proses job outbox yang due. Aman untuk multi-worker (FOR UPDATE SKIP LOCKED).
 * Mengembalikan jumlah job yang diproses.
 */
export async function processOutboxOnce(limit = 10): Promise<number> {
  // Klaim atomik: lease next_run_at +5 menit agar worker lain skip
  const claimed = await db.execute(sql`
    UPDATE outbox_jobs SET next_run_at = now() + interval '5 minutes'
    WHERE id IN (
      SELECT id FROM outbox_jobs
      WHERE status = 'menunggu' AND next_run_at <= now()
      ORDER BY next_run_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);
  const jobs = claimed as unknown as Job[];
  if (!jobs.length) return 0;

  for (const job of jobs) {
    try {
      await handle(job);
      await db.update(outboxJobs)
        .set({ status: 'sukses', lastError: null })
        .where(eq(outboxJobs.id, job.id));
      logger.info({ id: job.id, kind: job.kind }, 'Outbox job sukses');
    } catch (e) {
      if (e instanceof IntegrationNotConfigured) {
        // Bukan kegagalan nyata — tunda, jangan tambah attempts
        await db.update(outboxJobs)
          .set({ nextRunAt: new Date(Date.now() + NOT_CONFIGURED_RETRY_SEC * 1000), lastError: e.message })
          .where(eq(outboxJobs.id, job.id));
        logger.warn({ id: job.id, kind: job.kind }, 'Integrasi belum dikonfigurasi — ditunda');
        continue;
      }
      const attempts = job.attempts + 1;
      const msg = (e as Error).message?.slice(0, 500) ?? 'error';
      if (attempts >= MAX_ATTEMPTS) {
        await db.update(outboxJobs)
          .set({ status: 'gagal', attempts, lastError: msg })
          .where(eq(outboxJobs.id, job.id));
        if (job.kind === 'satusehat' && typeof (job.payload as Record<string, unknown>).encounterId === 'string') {
          await db.update(encounters)
            .set({ syncStatus: 'gagal' })
            .where(eq(encounters.id, String((job.payload as Record<string, unknown>).encounterId)));
        }
        logger.error({ id: job.id, kind: job.kind, attempts, err: msg }, 'Outbox job GAGAL permanen');
      } else {
        await db.update(outboxJobs)
          .set({ attempts, lastError: msg, nextRunAt: new Date(Date.now() + backoffSec(attempts) * 1000) })
          .where(eq(outboxJobs.id, job.id));
        logger.warn({ id: job.id, kind: job.kind, attempts, retryInSec: backoffSec(attempts) }, 'Outbox job retry');
      }
    }
  }
  return jobs.length;
}
