import { requireRole } from '@/lib/auth/session';
import { Soon } from '@/components/soon';

export default async function Page() {
  await requireRole(['admin']);
  return <Soon title="Laporan" desc="Keuangan, kunjungan, obat terlaris, penjamin." />;
}
