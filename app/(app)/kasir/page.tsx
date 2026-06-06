import { requireRole } from '@/lib/auth/session';
import { Soon } from '@/components/soon';

export default async function Page() {
  await requireRole(['admin', 'kasir']);
  return <Soon title="Kasir" desc="Tagihan otomatis dari tindakan + obat + jasa." />;
}
