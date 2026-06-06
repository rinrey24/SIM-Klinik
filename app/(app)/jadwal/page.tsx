import { requireAuth } from '@/lib/auth/session';
import { Soon } from '@/components/soon';

export default async function Page() {
  await requireAuth();
  return <Soon title="Jadwal & Janji Temu" desc="Kalender praktik dokter & reminder WhatsApp." />;
}
