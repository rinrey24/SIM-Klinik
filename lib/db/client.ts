// DB client tanpa 'server-only' — aman dipakai di Next (via lib/db) maupun
// proses worker standalone (tsx). Lihat lib/db/index.ts untuk pemakaian Next.
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';
import * as schema from '@/drizzle/schema';

declare global {
  // eslint-disable-next-line no-var
  var __pg: ReturnType<typeof postgres> | undefined;
}

const queryClient = global.__pg ?? postgres(env.DATABASE_URL, { max: 10 });
if (env.NODE_ENV !== 'production') global.__pg = queryClient;

export const db = drizzle(queryClient, { schema, casing: 'snake_case' });
export { schema };
