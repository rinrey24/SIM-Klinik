import { requireAuth } from '@/lib/auth/session';
import { AntrianClient } from './client';

export default async function AntrianPage() {
  const s = await requireAuth();
  return <AntrianClient role={s.role} />;
}
