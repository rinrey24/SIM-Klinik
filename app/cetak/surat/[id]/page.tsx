import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { documents, patients, users, branches } from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { formatTanggal } from '@/lib/utils';
import { PrintBar } from '@/components/print-trigger';

const TITLE: Record<string, string> = {
  sakit: 'SURAT KETERANGAN SAKIT',
  sehat: 'SURAT KETERANGAN SEHAT',
  rujukan: 'SURAT RUJUKAN',
};

function age(dob: string | null) {
  if (!dob) return '—';
  return `${new Date().getFullYear() - new Date(dob).getFullYear()} tahun`;
}

export default async function CetakSurat({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireAuth();
  const { id } = await params;

  const [doc] = await db.select({
    id: documents.id, type: documents.type, number: documents.number,
    data: documents.data, createdAt: documents.createdAt,
    pName: patients.name, pNik: patients.nik, pSex: patients.sex, pDob: patients.dob, pAddress: patients.address, pRm: patients.rmNumber,
    dName: users.name, dSip: users.sip,
    cName: branches.name, cAddress: branches.address, cPhone: branches.phone, cColor: branches.accentColor,
  })
    .from(documents)
    .innerJoin(patients, eq(patients.id, documents.patientId))
    .innerJoin(users, eq(users.id, documents.doctorId))
    .innerJoin(branches, eq(branches.id, documents.branchId))
    .where(and(eq(documents.id, id), eq(documents.branchId, s.branchId)))
    .limit(1);

  if (!doc) notFound();
  const d = (doc.data ?? {}) as Record<string, string>;
  const accent = doc.cColor ?? '#0d9488';

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <PrintBar title={`${TITLE[doc.type]} · ${doc.number}`} />
      <div className="print-sheet card" style={{ maxWidth: 720, margin: '0 auto 40px', padding: 48, background: '#fff', color: '#111' }}>
        {/* Kop surat */}
        <div className="flex items-center gap-3 pb-3" style={{ borderBottom: `3px solid ${accent}` }}>
          <div className="w-12 h-12 rounded-xl grid place-items-center text-white flex-none" style={{ background: accent }}>
            <span style={{ fontSize: 22 }}>✚</span>
          </div>
          <div className="flex-1">
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>{doc.cName}</div>
            <div style={{ fontSize: 12, color: '#555' }}>{doc.cAddress} · {doc.cPhone}</div>
          </div>
        </div>

        <h1 className="text-center" style={{ fontSize: 17, fontWeight: 800, margin: '24px 0 2px', textDecoration: 'underline' }}>
          {TITLE[doc.type]}
        </h1>
        <div className="text-center mono" style={{ fontSize: 12, color: '#555', marginBottom: 24 }}>No. {doc.number}</div>

        <p style={{ fontSize: 14, lineHeight: 1.9 }}>
          Yang bertanda tangan di bawah ini, dokter pada {doc.cName}, menerangkan bahwa:
        </p>

        <table style={{ fontSize: 14, lineHeight: 1.9, margin: '8px 0 8px 12px' }}>
          <tbody>
            <Row k="Nama" v={doc.pName} />
            <Row k="Umur" v={age(doc.pDob)} />
            <Row k="Jenis Kelamin" v={doc.pSex === 'L' ? 'Laki-laki' : 'Perempuan'} />
            <Row k="No. RM" v={doc.pRm} />
            {doc.pAddress && <Row k="Alamat" v={doc.pAddress} />}
          </tbody>
        </table>

        {doc.type === 'sakit' && (
          <p style={{ fontSize: 14, lineHeight: 1.9 }}>
            Berdasarkan hasil pemeriksaan, yang bersangkutan dinyatakan <strong>perlu beristirahat</strong> selama{' '}
            <strong>{d.restDays ?? '—'} ({terbilang(Number(d.restDays))}) hari</strong>
            {d.startDate && <> terhitung mulai tanggal <strong>{formatTanggal(d.startDate)}</strong></>}
            {d.diagnosis && <> karena <strong>{d.diagnosis}</strong></>}.
            {d.notes && <> {d.notes}</>}
          </p>
        )}
        {doc.type === 'sehat' && (
          <>
            <p style={{ fontSize: 14, lineHeight: 1.9 }}>Berdasarkan hasil pemeriksaan kesehatan:</p>
            <table style={{ fontSize: 14, lineHeight: 1.9, margin: '4px 0 8px 12px' }}>
              <tbody>
                {d.td && <Row k="Tekanan darah" v={`${d.td} mmHg`} />}
                {d.nadi && <Row k="Nadi" v={`${d.nadi} /menit`} />}
                {d.suhu && <Row k="Suhu" v={`${d.suhu} °C`} />}
                {d.bb && <Row k="Berat badan" v={`${d.bb} kg`} />}
                {d.tb && <Row k="Tinggi badan" v={`${d.tb} cm`} />}
              </tbody>
            </table>
            <p style={{ fontSize: 14, lineHeight: 1.9 }}>
              yang bersangkutan dinyatakan dalam keadaan <strong>SEHAT</strong>
              {d.purpose && <> dan surat ini digunakan untuk keperluan <strong>{d.purpose}</strong></>}.
              {d.notes && <> {d.notes}</>}
            </p>
          </>
        )}
        {doc.type === 'rujukan' && (
          <p style={{ fontSize: 14, lineHeight: 1.9 }}>
            Mohon perkenan Sejawat untuk memeriksa dan menangani lebih lanjut pasien tersebut di atas kepada{' '}
            <strong>{d.referralTo ?? '—'}</strong>
            {d.diagnosis && <> dengan diagnosis kerja <strong>{d.diagnosis}</strong></>}
            {d.reason && <>. Alasan rujukan: {d.reason}</>}.
            {d.notes && <> {d.notes}</>}
          </p>
        )}

        <p style={{ fontSize: 14, lineHeight: 1.9, marginTop: 12 }}>
          Demikian surat keterangan ini dibuat dengan sebenarnya agar dapat dipergunakan sebagaimana mestinya.
        </p>

        {/* Tanda tangan */}
        <div style={{ marginTop: 36, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ textAlign: 'center', fontSize: 14, lineHeight: 1.8 }}>
            <div>{doc.cAddress?.split(',').pop()?.trim() || 'Bandung'}, {formatTanggal(doc.createdAt)}</div>
            <div>Dokter Pemeriksa,</div>
            <div style={{ height: 64 }} />
            <div style={{ fontWeight: 700, textDecoration: 'underline' }}>{doc.dName}</div>
            {doc.dSip && <div className="mono" style={{ fontSize: 12, color: '#555' }}>SIP: {doc.dSip}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <td style={{ verticalAlign: 'top', paddingRight: 8, width: 130 }}>{k}</td>
      <td style={{ verticalAlign: 'top', paddingRight: 6 }}>:</td>
      <td style={{ fontWeight: 600 }}>{v}</td>
    </tr>
  );
}

function terbilang(n: number): string {
  const w = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  if (Number.isNaN(n)) return '—';
  if (n <= 11) return w[n] ?? String(n);
  if (n < 20) return `${w[n - 10]} belas`;
  return String(n);
}
