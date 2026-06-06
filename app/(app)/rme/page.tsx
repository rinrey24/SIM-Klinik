import { requireRole } from '@/lib/auth/session';
import { Soon } from '@/components/soon';

export default async function Page() {
  await requireRole(['admin', 'dokter']);
  return <Soon title="Rekam Medis Elektronik" desc="SOAP, ICD-10, tindakan, resep, dan sinkron SATUSEHAT." />;
}
