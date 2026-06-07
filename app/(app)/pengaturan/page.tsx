import { requireRole } from '@/lib/auth/session';
import { PengaturanClient } from './client';

export default async function PengaturanPage() {
  await requireRole(['admin']);
  return <PengaturanClient />;
}
