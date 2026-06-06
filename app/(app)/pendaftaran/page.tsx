import { requireRole } from '@/lib/auth/session';
import { PendaftaranClient } from './client';

export default async function PendaftaranPage() {
  await requireRole(['admin', 'pendaftaran', 'perawat']);
  return <PendaftaranClient />;
}
