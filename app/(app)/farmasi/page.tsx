import { requireRole } from '@/lib/auth/session';
import { Soon } from '@/components/soon';

export default async function Page() {
  await requireRole(['admin', 'apoteker']);
  return <Soon title="Farmasi" desc="Antrean resep, dispensing, dan stok obat." />;
}
