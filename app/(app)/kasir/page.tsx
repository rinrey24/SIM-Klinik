import { requireRole } from '@/lib/auth/session';
import { KasirClient } from './client';

export default async function KasirPage() {
  await requireRole(['admin', 'kasir']);
  return <KasirClient />;
}
