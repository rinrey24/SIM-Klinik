import { NextResponse } from 'next/server';
import { ZodError, type ZodSchema } from 'zod';

export type ApiError = { code: string; message: string; details?: unknown };

export function err(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export async function parseJson<T>(req: Request, schema: ZodSchema<T>): Promise<{ data: T } | { error: NextResponse }> {
  let body: unknown;
  try { body = await req.json(); } catch { return { error: err('INVALID_JSON', 'Body bukan JSON yang valid', 422) }; }
  try { return { data: schema.parse(body) }; }
  catch (e) {
    if (e instanceof ZodError) {
      return { error: err('VALIDATION_ERROR', e.issues[0]?.message ?? 'Validasi gagal', 422, e.flatten()) };
    }
    throw e;
  }
}
