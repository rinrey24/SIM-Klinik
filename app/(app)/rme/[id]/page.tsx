import { requireRole } from '@/lib/auth/session';
import { RMEClient } from './client';

export default async function RMEDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['admin', 'dokter']);
  const { id } = await params;
  return <RMEClient encounterId={id} />;
}
