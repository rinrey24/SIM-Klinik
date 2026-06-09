import { db, schema } from '@/lib/db/client';

const { outboxJobs } = schema;

type Kind = 'satusehat' | 'whatsapp' | 'bpjs' | 'email';

/**
 * Tulis job ke outbox (idempoten via idempotencyKey).
 * Aman dipanggil di dalam transaksi: berikan `tx`.
 */
export async function enqueueOutbox(
  kind: Kind,
  idempotencyKey: string,
  payload: Record<string, unknown>,
  tx?: typeof db,
) {
  const client = tx ?? db;
  await client.insert(outboxJobs).values({
    kind, payload, idempotencyKey, status: 'menunggu',
  }).onConflictDoNothing();
}
