import { requireAuth } from '@/lib/auth/session';
import { Soon } from '@/components/soon';

export default async function Page() {
  await requireAuth();
  return <Soon title="Antrian" desc="Papan antrian real-time akan tersedia di fase berikutnya." />;
}
