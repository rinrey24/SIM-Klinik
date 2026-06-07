import { requireAuth } from '@/lib/auth/session';
import { JadwalClient } from './client';

export default async function JadwalPage() {
  await requireAuth();
  return <JadwalClient />;
}
