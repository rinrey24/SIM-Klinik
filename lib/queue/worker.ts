import 'dotenv/config';
import { processOutboxOnce } from './outbox';
import { logger } from '@/lib/logger';

const POLL_MS = Number(process.env.OUTBOX_POLL_MS ?? 5000);
let running = true;

async function loop() {
  logger.info({ pollMs: POLL_MS }, '🛰️  Outbox worker dimulai');
  while (running) {
    try {
      const n = await processOutboxOnce(10);
      if (n > 0) logger.info({ processed: n }, 'Outbox tick');
    } catch (e) {
      logger.error({ err: (e as Error).message }, 'Outbox tick error');
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

function shutdown(sig: string) {
  logger.info({ sig }, 'Outbox worker berhenti');
  running = false;
  setTimeout(() => process.exit(0), 200);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

loop().catch((e) => { logger.error({ err: (e as Error).message }, 'Worker fatal'); process.exit(1); });
