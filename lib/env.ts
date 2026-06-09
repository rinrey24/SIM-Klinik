import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  TZ: z.string().default('Asia/Jakarta'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL wajib diisi'),
  REDIS_URL: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET minimal 32 karakter'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET minimal 32 karakter'),
  DATA_ENCRYPTION_KEY: z.string().min(16),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SENTRY_DSN: z.string().optional(),

  WA_PROVIDER_URL: z.string().url().optional(),
  WA_PROVIDER_TOKEN: z.string().optional(),
  EMAIL_API_KEY: z.string().optional(),

  SATUSEHAT_BASE_URL: z.string().url().optional(),
  SATUSEHAT_AUTH_URL: z.string().url().optional(),
  SATUSEHAT_CLIENT_ID: z.string().optional(),
  SATUSEHAT_CLIENT_SECRET: z.string().optional(),
  SATUSEHAT_ORG_ID: z.string().optional(),

  BPJS_PCARE_BASE_URL: z.string().url().optional(),
  BPJS_PCARE_SERVICE: z.string().default('pcare-rest-v3.0'),
  BPJS_CONS_ID: z.string().optional(),
  BPJS_CONS_SECRET: z.string().optional(),
  BPJS_PCARE_USER_KEY: z.string().optional(),
  BPJS_PCARE_USERNAME: z.string().optional(),
  BPJS_PCARE_PASSWORD: z.string().optional(),
  BPJS_PCARE_APP_CODE: z.string().default('095'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Konfigurasi environment tidak valid:\n', parsed.error.flatten().fieldErrors);
  throw new Error('Environment variable tidak valid');
}

export const env = parsed.data;
export type Env = typeof env;
