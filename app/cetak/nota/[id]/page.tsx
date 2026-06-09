import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { bills, billItems, patients, branches, encounters, users } from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { formatRp } from '@/lib/utils';
import { PrintBar } from '@/components/print-trigger';

const GROUPS: { key: 'jasa' | 'tindakan' | 'obat'; label: string }[] = [
  { key: 'jasa', label: 'Jasa & Konsultasi' },
  { key: 'tindakan', label: 'Tindakan Medis' },
  { key: 'obat', label: 'Obat & Farmasi' },
];

export default async function CetakNota({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireAuth();
  const { id } = await params;

  const [bill] = await db.select({
    id: bills.id, status: bills.status, total: bills.total, payMethod: bills.payMethod,
    paidAt: bills.paidAt, createdAt: bills.createdAt,
    pName: patients.name, pRm: patients.rmNumber, pPenjamin: patients.penjamin,
    dName: users.name, queueNo: encounters.queueNo,
    cName: branches.name, cAddress: branches.address, cPhone: branches.phone, cColor: branches.accentColor,
  })
    .from(bills)
    .innerJoin(patients, eq(patients.id, bills.patientId))
    .innerJoin(encounters, eq(encounters.id, bills.encounterId))
    .innerJoin(users, eq(users.id, encounters.doctorId))
    .innerJoin(branches, eq(branches.id, bills.branchId))
    .where(and(eq(bills.id, id), eq(bills.branchId, s.branchId)))
    .limit(1);

  if (!bill) notFound();
  const items = await db.select().from(billItems).where(eq(billItems.billId, id));
  const accent = bill.cColor ?? '#0d9488';
  const subtotal = items.reduce((sum, i) => sum + Number(i.price) * i.qty, 0);
  const isBpjs = bill.payMethod === 'bpjs';
  const dibayar = isBpjs ? 0 : subtotal;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <PrintBar title={`Nota · INV/${bill.id.slice(-6).toUpperCase()}`} />
      <div className="print-sheet card" style={{ maxWidth: 420, margin: '0 auto 40px', padding: 28, background: '#fff', color: '#111' }}>
        <div className="text-center pb-3" style={{ borderBottom: `2px dashed #ccc` }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: accent }}>{bill.cName}</div>
          <div style={{ fontSize: 11, color: '#555' }}>{bill.cAddress}</div>
          <div style={{ fontSize: 11, color: '#555' }}>{bill.cPhone}</div>
        </div>

        <div style={{ fontSize: 12, lineHeight: 1.7, padding: '12px 0', borderBottom: '2px dashed #ccc' }}>
          <Line k="No. Nota" v={`INV/${bill.id.slice(-6).toUpperCase()}`} />
          <Line k="Tanggal" v={new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(bill.paidAt ?? bill.createdAt)} />
          <Line k="No. Antrian" v={bill.queueNo} />
          <Line k="Pasien" v={`${bill.pName} (${bill.pRm})`} />
          <Line k="Dokter" v={bill.dName} />
        </div>

        <div style={{ padding: '12px 0', borderBottom: '2px dashed #ccc' }}>
          {GROUPS.map((g) => {
            const its = items.filter((i) => i.type === g.key);
            if (!its.length) return null;
            return (
              <div key={g.key} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#888', letterSpacing: '.04em', marginBottom: 2 }}>{g.label}</div>
                {its.map((i) => (
                  <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
                    <span>{i.label}{i.qty > 1 && <span style={{ color: '#888' }}> ×{i.qty}</span>}</span>
                    <span className="mono">{formatRp(Number(i.price) * i.qty)}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div style={{ padding: '12px 0', fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
            <span style={{ color: '#555' }}>Subtotal</span><span className="mono">{formatRp(subtotal)}</span>
          </div>
          {isBpjs && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: accent }}>
              <span>Ditanggung BPJS</span><span className="mono">−{formatRp(subtotal)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontWeight: 800, fontSize: 16, borderTop: '1px solid #eee', marginTop: 4 }}>
            <span>TOTAL</span><span className="mono">{formatRp(dibayar)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555' }}>
            <span>Metode</span><span style={{ textTransform: 'uppercase' }}>{bill.payMethod ?? '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555' }}>
            <span>Status</span><span style={{ fontWeight: 700, color: bill.status === 'lunas' ? accent : '#d97706' }}>{bill.status.toUpperCase()}</span>
          </div>
        </div>

        <div className="text-center" style={{ fontSize: 11, color: '#888', borderTop: '2px dashed #ccc', paddingTop: 12 }}>
          Terima kasih atas kunjungan Anda.<br />Semoga lekas sehat. 🙏
        </div>
      </div>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: '#555' }}>{k}</span>
      <span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
    </div>
  );
}
