import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { encounters, patients, users } from '@/drizzle/schema';
import { and, desc, eq, ne } from 'drizzle-orm';
import Link from 'next/link';
import { Avatar, QueueBadge, EmptyState } from '@/components/ui/primitives';
import { Stethoscope } from 'lucide-react';

export default async function RMEIndex() {
  const s = await requireRole(['admin', 'dokter']);
  const rows = await db.select({
    id: encounters.id, queueNo: encounters.queueNo, status: encounters.status,
    complaint: encounters.complaint, arrivedAt: encounters.arrivedAt,
    patient: { id: patients.id, name: patients.name, rmNumber: patients.rmNumber, penjamin: patients.penjamin },
  })
    .from(encounters)
    .innerJoin(patients, eq(patients.id, encounters.patientId))
    .where(and(eq(encounters.branchId, s.branchId), ne(encounters.status, 'selesai'), ne(encounters.status, 'batal')))
    .orderBy(desc(encounters.arrivedAt));

  return (
    <div className="fade-in flex flex-col gap-3.5">
      <div>
        <h1 className="h1">Rekam Medis Elektronik</h1>
        <div className="muted text-[13.5px] mt-0.5">
          Pilih pasien dari antrian untuk memulai pemeriksaan.
        </div>
      </div>
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <div className="p-2">
            <EmptyState icon={Stethoscope} title="Belum ada pasien" sub="Antrian kosong untuk saat ini." />
          </div>
        ) : (
          rows.map((q) => (
            <Link
              key={q.id}
              href={`/rme/${q.id}`}
              className="flex items-center gap-3 px-4 py-3 border-b transition-colors hover:bg-[var(--surface-2)]"
              style={{ borderColor: 'var(--line-2)' }}
            >
              <span className="mono" style={{ fontWeight: 800, color: 'var(--teal-600)', width: 42 }}>{q.queueNo}</span>
              <Avatar name={q.patient.name} size={38} />
              <div className="flex-1 min-w-0">
                <strong className="text-[14px]">{q.patient.name}</strong>
                <div className="muted text-[12px] truncate">{q.complaint || '—'}</div>
              </div>
              <QueueBadge status={q.status as 'menunggu' | 'dipanggil' | 'dilayani'} />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
