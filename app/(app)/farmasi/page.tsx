import { requireRole } from '@/lib/auth/session';
import { FarmasiClient } from './client';

export default async function FarmasiPage() {
  await requireRole(['admin', 'apoteker']);
  return <FarmasiClient />;
}
