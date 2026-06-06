import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: './drizzle/migrations' });
  console.log('✅ Migrasi selesai');
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
