import crypto from 'node:crypto';
import LZString from 'lz-string';
import { env } from '@/lib/env';

/**
 * Dekripsi respons terenkripsi BPJS.
 * Kunci diturunkan dari consId + consSecret + timestamp (yang dikirim di request).
 * key = SHA-256(consId + consSecret + timestamp) → 32 byte (AES-256)
 * iv  = 16 byte pertama dari key
 * AES-256-CBC → string base64 hasil kompresi LZ-String → LZString.decompressFromEncodedURIComponent
 *
 * Catatan: detail terkini wajib diverifikasi di BPJS Trustmark; pustaka
 * @ssecd/jkn menangani ini otomatis. Implementasi ini sesuai mekanisme PRD §12.2.
 */
export function decryptPcare(encrypted: string, timestamp: string): string {
  const consId = env.BPJS_CONS_ID!;
  const secret = env.BPJS_CONS_SECRET!;
  const keyStr = consId + secret + timestamp;
  const key = crypto.createHash('sha256').update(keyStr).digest(); // 32 byte → AES-256
  const iv = key.subarray(0, 16);

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  // BPJS mengompres dengan LZString (varian decompressFromEncodedURIComponent)
  const decompressed = LZString.decompressFromEncodedURIComponent(decrypted);
  return decompressed ?? decrypted;
}
