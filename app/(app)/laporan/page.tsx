import { requireRole } from '@/lib/auth/session';
import { LaporanClient } from './client';

export default async function LaporanPage() {
  await requireRole(['admin']);
  return <LaporanClient />;
}
