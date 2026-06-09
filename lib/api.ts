import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

export type ApiError = { code: string; message: string; details?: unknown };

export function err(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export async function parseJson<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<{ data: z.infer<S> } | { error: NextResponse }> {
  let body: unknown;
  try { body = await req.json(); } catch { return { error: err('INVALID_JSON', 'Body bukan JSON yang valid', 422) }; }
  try { return { data: schema.parse(body) as z.infer<S> }; }
  catch (e) {
    if (e instanceof ZodError) {
      return { error: err('VALIDATION_ERROR', e.issues[0]?.message ?? 'Validasi gagal', 422, e.flatten()) };
    }
    throw e;
  }
}
