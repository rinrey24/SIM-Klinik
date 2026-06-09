'use client';
import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Printer, Search, Send } from 'lucide-react';
import { Avatar, EmptyState, Modal, Toast } from '@/components/ui/primitives';
import { formatTanggal } from '@/lib/utils';

type DocType = 'sakit' | 'sehat' | 'rujukan';
type Doc = {
  id: string; type: DocType; number: string; createdAt: string;
  data: Record<string, string>;
  patient: { id: string; name: string; rmNumber: string };
  doctor: { id: string; name: string };
};
type Patient = { id: string; name: string; rmNumber: string; nik: string | null; penjamin: string };

const TYPE_META: Record<DocType, { label: string; badge: string }> = {
  sakit: { label: 'Surat Sakit', badge: 'b-amber' },
  sehat: { label: 'Surat Sehat', badge: 'b-green' },
  rujukan: { label: 'Surat Rujukan', badge: 'b-sky' },
};

export function SuratClient() {
  const qc = useQueryClient();
  const [openCreate, setOpenCreate] = React.useState(false);
  const [toast, setToast] = React.useState<{ kind: 'info' | 'success'; msg: string } | null>(null);
  const pushToast = (k: 'info' | 'success', m: string) => { setToast({ kind: k, msg: m }); setTimeout(() => setToast(null), 3200); };

  const list = useQuery({
    queryKey: ['documents'],
    queryFn: async () => (await (await fetch('/api/documents')).json()) as { data: Doc[] },
  });
  const docs = list.data?.data ?? [];

  return (
    <div className="fade-in flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="h1">Surat Keterangan</h1>
          <div className="muted text-[13.5px] mt-0.5">
            Terbitkan & cetak surat sakit, surat sehat, dan surat rujukan.
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setOpenCreate(true)}>
          <Plus size={18} /> Buat Surat
        </button>
      </div>

      <div className="card overflow-hidden" style={{ padding: 0 }}>
        {list.isLoading ? (
          <div className="p-4 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="skel h-14" />)}</div>
        ) : docs.length === 0 ? (
          <div className="p-2"><EmptyState icon={FileText} title="Belum ada surat" sub="Surat yang Anda terbitkan akan muncul di sini." /></div>
        ) : (
          docs.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-3 px-4 py-3 border-b"
              style={{ borderColor: 'var(--line-2)' }}
            >
              <Avatar name={d.patient.name} size={40} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <strong className="text-[14px]">{d.patient.name}</strong>
                  <span className={`badge ${TYPE_META[d.type].badge}`}>{TYPE_META[d.type].label}</span>
                </div>
                <div className="muted mono text-[12px] mt-0.5">{d.number} · {formatTanggal(d.createdAt)}</div>
              </div>
              <button className="btn btn-sm btn-soft" onClick={() => window.open(`/cetak/surat/${d.id}`, '_blank')}>
                <Printer size={14} /> Cetak
              </button>
            </div>
          ))
        )}
      </div>

      {openCreate && (
        <CreateForm
          onClose={() => setOpenCreate(false)}
          onCreated={(id) => {
            qc.invalidateQueries({ queryKey: ['documents'] });
            setOpenCreate(false);
            pushToast('success', 'Surat diterbitkan');
            window.open(`/cetak/surat/${id}`, '_blank');
          }}
          onError={(m) => pushToast('info', m)}
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

function CreateForm({
  onClose, onCreated, onError,
}: { onClose: () => void; onCreated: (id: string) => void; onError: (m: string) => void }) {
  const [type, setType] = React.useState<DocType>('sakit');
  const [patient, setPatient] = React.useState<Patient | null>(null);
  const [q, setQ] = React.useState('');
  const [data, setData] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  const search = useQuery({
    queryKey: ['patients', 'surat', q],
    queryFn: async () => (await (await fetch(`/api/patients?q=${encodeURIComponent(q)}&limit=6`)).json()) as { data: Patient[] },
    enabled: !patient,
    placeholderData: (p) => p,
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setData({ ...data, [k]: e.target.value });

  const valid = !!patient && (
    type === 'sakit' ? Number(data.restDays) > 0 :
    type === 'sehat' ? !!data.purpose :
    !!data.referralTo
  );

  const submit = async () => {
    if (!patient) return;
    setBusy(true);
    try {
      const r = await fetch('/api/documents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: patient.id, type, data }),
      });
      const res = await r.json();
      if (!r.ok) throw new Error(res?.error?.message ?? 'Gagal membuat surat');
      onCreated(res.data.id);
    } catch (e) { onError((e as Error).message); setBusy(false); }
  };

  return (
    <Modal title="Buat Surat Keterangan" onClose={onClose} wide footer={
      <>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Batal</button>
        <button className="btn btn-primary" disabled={!valid || busy} onClick={submit}><Send size={16} /> Terbitkan & Cetak</button>
      </>
    }>
      <div className="flex flex-col gap-3.5">
        {/* Jenis surat */}
        <div className="field">
          <label className="label">Jenis surat</label>
          <div className="seg" style={{ width: '100%' }}>
            {(['sakit', 'sehat', 'rujukan'] as const).map((t) => (
              <button key={t} type="button" className={type === t ? 'on' : ''} style={{ flex: 1 }} onClick={() => { setType(t); setData({}); }}>
                {TYPE_META[t].label}
              </button>
            ))}
          </div>
        </div>

        {/* Pasien */}
        <div className="field">
          <label className="label">Pasien</label>
          {patient ? (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-[10px]" style={{ background: 'var(--surface-2)' }}>
              <Avatar name={patient.name} size={34} />
              <div className="flex-1 min-w-0">
                <strong className="text-[13.5px]">{patient.name}</strong>
                <div className="muted mono text-[12px]">{patient.rmNumber}</div>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => setPatient(null)}>Ganti</button>
            </div>
          ) : (
            <>
              <div className="input-icon">
                <Search size={18} />
                <input className="input" placeholder="Cari nama / NIK / No. RM…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
              </div>
              {q.trim() && (
                <div className="flex flex-col gap-1 mt-1" style={{ maxHeight: 180, overflowY: 'auto' }}>
                  {(search.data?.data ?? []).map((p) => (
                    <button key={p.id} className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-left" style={{ background: 'var(--surface-2)' }} onClick={() => setPatient(p)}>
                      <Avatar name={p.name} size={30} />
                      <div className="flex-1 min-w-0">
                        <strong className="text-[13px]">{p.name}</strong>
                        <div className="muted mono text-[11.5px]">{p.rmNumber}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Field per jenis */}
        {type === 'sakit' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FieldNum label="Lama istirahat (hari)" k="restDays" set={set} data={data} />
            <FieldDate label="Mulai tanggal" k="startDate" set={set} data={data} />
            <FieldText label="Diagnosis" k="diagnosis" set={set} data={data} full placeholder="cth. ISPA" />
            <FieldText label="Catatan tambahan" k="notes" set={set} data={data} full />
          </div>
        )}
        {type === 'sehat' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <FieldText label="Tek. darah" k="td" set={set} data={data} placeholder="120/80" />
            <FieldText label="Nadi" k="nadi" set={set} data={data} placeholder="80" />
            <FieldText label="Suhu" k="suhu" set={set} data={data} placeholder="36.5" />
            <FieldText label="Berat (kg)" k="bb" set={set} data={data} />
            <FieldText label="Tinggi (cm)" k="tb" set={set} data={data} />
            <FieldText label="Keperluan" k="purpose" set={set} data={data} full placeholder="cth. melamar kerja" />
          </div>
        )}
        {type === 'rujukan' && (
          <div className="grid grid-cols-1 gap-3">
            <FieldText label="Dirujuk ke (faskes/spesialis)" k="referralTo" set={set} data={data} placeholder="cth. RS Hasan Sadikin — Sp. Penyakit Dalam" />
            <FieldText label="Diagnosis kerja" k="diagnosis" set={set} data={data} />
            <FieldText label="Alasan rujukan" k="reason" set={set} data={data} />
          </div>
        )}
      </div>
    </Modal>
  );
}

function FieldText({ label, k, set, data, full, placeholder }: { label: string; k: string; set: (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => void; data: Record<string, string>; full?: boolean; placeholder?: string }) {
  return (
    <div className="field" style={{ gridColumn: full ? '1 / -1' : undefined }}>
      <label className="label">{label}</label>
      <input className="input" value={data[k] ?? ''} onChange={set(k)} placeholder={placeholder} />
    </div>
  );
}
function FieldNum({ label, k, set, data }: { label: string; k: string; set: (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => void; data: Record<string, string> }) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      <input className="input mono" type="number" min={1} value={data[k] ?? ''} onChange={set(k)} />
    </div>
  );
}
function FieldDate({ label, k, set, data }: { label: string; k: string; set: (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => void; data: Record<string, string> }) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      <input className="input mono" type="date" value={data[k] ?? ''} onChange={set(k)} />
    </div>
  );
}
