import { requireRole } from '@/lib/auth/session';
import { SuratClient } from './client';

export default async function SuratPage() {
  await requireRole(['admin', 'dokter']);
  return <SuratClient />;
}
