'use client';
import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus, ChevronRight, Plus, Info, FileText, Check, AlertTriangle, Shield } from 'lucide-react';
import { Avatar, PenjaminBadge, EmptyState, Modal, Toast } from '@/components/ui/primitives';
import { formatTanggal } from '@/lib/utils';

type Penjamin = 'BPJS' | 'Umum' | 'Asuransi';

type Patient = {
  id: string; rmNumber: string; nik: string | null; name: string;
  sex: 'L' | 'P'; dob: string | null; phone: string | null; address: string | null;
  penjamin: Penjamin; bpjsNumber: string | null; allergies: string | null;
};

type Doctor = { id: string; name: string; sip: string | null };

export function PendaftaranClient() {
  const [q, setQ] = React.useState('');
  const [sel, setSel] = React.useState<Patient | null>(null);
  const [showNew, setShowNew] = React.useState(false);
  const [toast, setToast] = React.useState<{ kind: 'info' | 'success'; msg: string } | null>(null);
  const qc = useQueryClient();

  const pushToast = (kind: 'info' | 'success', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3200);
  };

  const list = useQuery({
    queryKey: ['patients', q],
    queryFn: async () => {
      const r = await fetch(`/api/patients?q=${encodeURIComponent(q)}&limit=10`);
      if (!r.ok) throw new Error('Gagal memuat pasien');
      return r.json() as Promise<{ data: Patient[]; total: number }>;
    },
    placeholderData: (p) => p,
  });

  const doctors = useQuery({
    queryKey: ['doctors'],
    queryFn: async () => {
      const r = await fetch('/api/doctors');
      return (await r.json()) as { data: Doctor[] };
    },
  });

  const enqueue = useMutation({
    mutationFn: async ({ patientId, complaint }: { patientId: string; complaint?: string }) => {
      const doctorId = doctors.data?.data?.[0]?.id;
      if (!doctorId) throw new Error('Belum ada dokter terdaftar');
      const r = await fetch('/api/encounters', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, doctorId, complaint: complaint ?? '' }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error?.message ?? 'Gagal membuat antrian');
      return data.data as { queueNo: string };
    },
    onSuccess: (d) => {
      pushToast('success', `Pasien masuk antrian ${d.queueNo}`);
      qc.invalidateQueries({ queryKey: ['encounters'] });
    },
    onError: (e: Error) => pushToast('info', e.message),
  });

  const rows = list.data?.data ?? [];

  return (
    <div className="fade-in flex flex-col gap-4">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <h1 className="h1">Pendaftaran Pasien</h1>
          <div className="muted text-[13.5px] mt-0.5">
            Cari pasien lama atau daftarkan pasien baru ke antrian poli umum.
          </div>
        </div>
        <button className="btn btn-primary hidden md:inline-flex" onClick={() => setShowNew(true)}>
          <UserPlus size={18} /> Pasien Baru
        </button>
      </div>

      <div className="card card-pad">
        <div className="input-icon">
          <Search size={18} />
          <input
            className="input"
            placeholder="Cari NIK / No. RM / nama / no. HP…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="muted text-[12px] font-semibold">Filter cepat:</span>
          {(['Semua', 'BPJS', 'Umum', 'Asuransi'] as const).map((f) => (
            <span key={f} className="badge b-gray cursor-pointer">{f}</span>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden" style={{ padding: 0 }}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--line)' }}>
          <span className="eyebrow">
            {q.trim() ? `${rows.length} hasil ditemukan` : 'Pasien terakhir'}
          </span>
          <span className="muted text-[12px]">{list.data?.total ?? 0} total terdaftar</span>
        </div>
        {list.isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="skel h-14" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-2">
            <EmptyState
              icon={Search}
              title="Pasien tidak ditemukan"
              sub={`"${q}" belum terdaftar. Daftarkan sebagai pasien baru?`}
              action={
                <button className="btn btn-primary btn-sm mt-2" onClick={() => setShowNew(true)}>
                  <UserPlus size={16} /> Daftar Pasien Baru
                </button>
              }
            />
          </div>
        ) : (
          <div>
            {rows.map((p) => (
              <button
                key={p.id}
                onClick={() => setSel(p)}
                className="flex items-center gap-3 px-4 py-3 w-full text-left border-b transition-colors hover:bg-[var(--surface-2)]"
                style={{ borderColor: 'var(--line-2)' }}
              >
                <Avatar name={p.name} size={42} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <strong className="text-sm">{p.name}</strong>
                    <PenjaminBadge jenis={p.penjamin} sm />
                  </div>
                  <div className="muted mono text-[12px] mt-0.5">
                    {p.rmNumber} · {p.nik ? `NIK ${p.nik}` : (p.phone ?? '—')}
                  </div>
                </div>
                <ChevronRight size={18} className="muted" />
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="btn btn-primary btn-block md:hidden" onClick={() => setShowNew(true)}>
        <UserPlus size={18} /> Daftar Pasien Baru
      </button>

      {sel && (
        <PatientSheet
          p={sel}
          onClose={() => setSel(null)}
          onEnqueue={() => { enqueue.mutate({ patientId: sel.id, complaint: '' }); setSel(null); }}
        />
      )}
      {showNew && (
        <NewPatientForm
          onClose={() => setShowNew(false)}
          onCreated={(p, addToQueue) => {
            qc.invalidateQueries({ queryKey: ['patients'] });
            if (addToQueue) enqueue.mutate({ patientId: p.id, complaint: '' });
            else pushToast('success', `Data ${p.name} tersimpan`);
            setShowNew(false);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-24 md:bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none px-4">
          <Toast kind={toast.kind}>{toast.msg}</Toast>
        </div>
      )}
    </div>
  );
}

function PatientSheet({ p, onClose, onEnqueue }: { p: Patient; onClose: () => void; onEnqueue: () => void }) {
  return (
    <Modal
      title="Detail Pasien"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            <FileText size={16} /> Rekam Medis
          </button>
          <button className="btn btn-primary" onClick={onEnqueue}>
            <Plus size={16} /> Masukkan ke Antrian
          </button>
        </>
      }
    >
      <div className="flex items-center gap-3.5 mb-4">
        <Avatar name={p.name} size={56} />
        <div>
          <div className="font-extrabold text-[17px]">{p.name}</div>
          <div className="flex items-center gap-1.5 mt-1">
            <PenjaminBadge jenis={p.penjamin} />
            {p.penjamin === 'BPJS' && p.bpjsNumber && (
              <span className="badge b-gray mono" style={{ fontSize: 11 }}>{p.bpjsNumber}</span>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {([
          ['No. RM', p.rmNumber, true],
          ['NIK', p.nik ?? '—', true],
          ['Tgl lahir', formatTanggal(p.dob), false],
          ['Jenis kelamin', p.sex === 'L' ? 'Laki-laki' : 'Perempuan', false],
          ['No. HP', p.phone ?? '—', true],
          ['Alergi', p.allergies ?? '—', false],
        ] as const).map(([k, v, mono]) => (
          <div key={k} className="rounded-[10px] px-3 py-2.5" style={{ background: 'var(--surface-2)' }}>
            <div className="muted text-[11px] font-semibold">{k}</div>
            <div
              className={mono ? 'mono' : ''}
              style={{
                fontSize: 13.5, fontWeight: 700, marginTop: 2,
                color: k === 'Alergi' && v !== '—' ? 'var(--red)' : undefined,
              }}
            >
              {v}
            </div>
          </div>
        ))}
      </div>
      {p.address && (
        <div className="rounded-[10px] px-3 py-2.5 mt-2.5" style={{ background: 'var(--surface-2)' }}>
          <div className="muted text-[11px] font-semibold">Alamat</div>
          <div className="text-[13px]">{p.address}</div>
        </div>
      )}
    </Modal>
  );
}

function NewPatientForm({
  onClose, onCreated,
}: { onClose: () => void; onCreated: (p: Patient, addToQueue: boolean) => void }) {
  const [f, setF] = React.useState({
    name: '', nik: '', dob: '', sex: 'L' as 'L' | 'P',
    phone: '', address: '', penjamin: 'Umum' as Penjamin, bpjsNumber: '', allergies: '',
  });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [bpjsCheck, setBpjsCheck] = React.useState<
    { state: 'idle' | 'loading' | 'ok' | 'error'; msg?: string }
  >({ state: 'idle' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  const cekPeserta = async () => {
    setBpjsCheck({ state: 'loading' });
    try {
      const params = f.bpjsNumber.trim()
        ? `noKartu=${encodeURIComponent(f.bpjsNumber.trim())}`
        : `nik=${encodeURIComponent(f.nik.trim())}`;
      const r = await fetch(`/api/integrations/bpjs/peserta?${params}`);
      const data = await r.json();
      if (!r.ok) { setBpjsCheck({ state: 'error', msg: data?.error?.message ?? 'Gagal cek peserta' }); return; }
      const p = data.data;
      if (p.nama && !f.name) setF((cur) => ({ ...cur, name: p.nama }));
      setBpjsCheck({ state: 'ok', msg: `${p.nama} · ${p.status}${p.faskes ? ` · ${p.faskes}` : ''}` });
    } catch {
      setBpjsCheck({ state: 'error', msg: 'Terjadi gangguan jaringan.' });
    }
  };

  const valid = f.name.trim().length > 2 && (f.nik === '' || /^\d{16}$/.test(f.nik))
    && (f.penjamin !== 'BPJS' || f.bpjsNumber.trim().length > 0);

  const submit = async (addToQueue: boolean) => {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/patients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const data = await r.json();
      if (!r.ok) { setErr(data?.error?.message ?? 'Gagal menyimpan'); setBusy(false); return; }
      onCreated(data.data, addToQueue);
    } catch {
      setErr('Terjadi gangguan jaringan.'); setBusy(false);
    }
  };

  return (
    <Modal
      title="Pendaftaran Pasien Baru"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Batal</button>
          <button className="btn btn-ghost" disabled={!valid || busy} onClick={() => submit(false)}>
            Simpan saja
          </button>
          <button className="btn btn-primary" disabled={!valid || busy} onClick={() => submit(true)}>
            <Plus size={16} /> Simpan & Antrikan
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Nama lengkap" full><input className="input" placeholder="cth. Andi Wijaya" value={f.name} onChange={set('name')} /></Field>
        <Field label="NIK"><input className="input mono" placeholder="16 digit" value={f.nik} onChange={set('nik')} maxLength={16} /></Field>
        <Field label="Tanggal lahir"><input className="input mono" placeholder="DD/MM/YYYY" value={f.dob} onChange={set('dob')} /></Field>
        <Field label="Jenis kelamin">
          <select className="select" value={f.sex} onChange={set('sex')}>
            <option value="L">Laki-laki</option><option value="P">Perempuan</option>
          </select>
        </Field>
        <Field label="No. HP"><input className="input mono" placeholder="08xx" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Penjamin">
          <div className="seg" style={{ width: '100%' }}>
            {(['Umum', 'BPJS', 'Asuransi'] as const).map((x) => (
              <button
                key={x} type="button"
                className={f.penjamin === x ? 'on' : ''}
                style={{ flex: 1 }}
                onClick={() => setF({ ...f, penjamin: x })}
              >
                {x}
              </button>
            ))}
          </div>
        </Field>
        {f.penjamin === 'BPJS' && (
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="label">No. Kartu BPJS</label>
            <div className="flex gap-2">
              <input className="input mono" placeholder="13 digit" value={f.bpjsNumber} onChange={set('bpjsNumber')} />
              <button
                type="button"
                className="btn btn-ghost btn-sm flex-none"
                disabled={bpjsCheck.state === 'loading' || (!f.bpjsNumber.trim() && !/^\d{16}$/.test(f.nik))}
                onClick={cekPeserta}
              >
                <Shield size={15} /> {bpjsCheck.state === 'loading' ? 'Mengecek…' : 'Cek Peserta'}
              </button>
            </div>
            {bpjsCheck.state === 'ok' && (
              <div className="flex items-center gap-1.5 mt-1 text-[12px] font-semibold" style={{ color: 'var(--green)' }}>
                <Check size={14} /> {bpjsCheck.msg}
              </div>
            )}
            {bpjsCheck.state === 'error' && (
              <div className="flex items-center gap-1.5 mt-1 text-[12px] font-semibold" style={{ color: 'var(--red)' }}>
                <AlertTriangle size={14} /> {bpjsCheck.msg}
              </div>
            )}
          </div>
        )}
        <Field label="Alamat" full>
          <input className="input" placeholder="Alamat domisili" value={f.address} onChange={set('address')} />
        </Field>
        <Field label="Alergi" full>
          <input className="input" placeholder="cth. Amoxicillin (atau kosongkan)" value={f.allergies} onChange={set('allergies')} />
        </Field>
      </div>

      {f.penjamin === 'BPJS' && (
        <div className="flex items-start gap-2 mt-3 px-3 py-2.5 rounded-[10px] text-[12.5px]" style={{ background: 'var(--teal-tint)' }}>
          <Info size={16} style={{ color: 'var(--teal-600)', flex: 'none', marginTop: 2 }} />
          <span className="muted">
            Pasien BPJS: pastikan rujukan/kartu aktif. Kelayakan dicek otomatis ke BPJS saat pemanggilan.
          </span>
        </div>
      )}

      {err && (
        <div className="flex items-center gap-1.5 mt-3 text-[12.5px] font-semibold" style={{ color: 'var(--red)' }}>
          <AlertTriangle size={15} /> {err}
        </div>
      )}
    </Modal>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className="field" style={{ gridColumn: full ? '1 / -1' : undefined }}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
