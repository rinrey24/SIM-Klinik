'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Heart, Activity, Thermometer, Droplet, Plus, Pill, Trash2, Check,
  CheckCircle2, Search, FileText, type LucideIcon,
} from 'lucide-react';
import { Avatar, PenjaminBadge, SatuSehatBadge, EmptyState, Modal, Toast } from '@/components/ui/primitives';
import { formatTanggal } from '@/lib/utils';

type Patient = { id: string; name: string; rmNumber: string; nik: string | null; sex: 'L' | 'P'; dob: string | null; phone: string | null; penjamin: 'BPJS' | 'Umum' | 'Asuransi'; bpjsNumber: string | null; allergies: string | null };
type Doctor = { id: string; name: string; sip: string | null };
type Vital = { td: string | null; nadi: number | null; suhu: string | null; rr: number | null; spo2: number | null; bb: string | null; tb: string | null };
type Encounter = {
  id: string; queueNo: string; status: string; complaint: string | null; arrivedAt: string;
  startedAt: string | null; finishedAt: string | null; syncStatus: 'menunggu' | 'tersinkron' | 'gagal';
  patient: Patient; doctor: Doctor;
  vital: Vital | null;
  history: { id: string; queueNo: string; finishedAt: string | null; doctorName: string; a: string | null; s: string | null }[];
};
type Icd = { code: string; name: string };
type Tariff = { id: string; label: string; price: string; type: 'jasa' | 'tindakan' };
type Drug = { id: string; name: string; kind: string; stock: number; minStock: number; price: string };

export function RMEClient({ encounterId }: { encounterId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [toast, setToast] = React.useState<{ kind: 'info' | 'success'; msg: string } | null>(null);
  const pushToast = (k: 'info' | 'success', m: string) => { setToast({ kind: k, msg: m }); setTimeout(() => setToast(null), 3200); };

  const detail = useQuery({
    queryKey: ['encounter', encounterId],
    queryFn: async () => {
      const r = await fetch(`/api/encounters/${encounterId}`);
      if (!r.ok) throw new Error('Kunjungan tidak ditemukan');
      return (await r.json()) as { data: Encounter };
    },
  });

  // Auto-transisi dipanggil → dilayani saat dokter membuka RME
  React.useEffect(() => {
    const e = detail.data?.data;
    if (!e) return;
    if (e.status === 'dipanggil') {
      fetch(`/api/encounters/${encounterId}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dilayani' }),
      }).then(() => qc.invalidateQueries({ queryKey: ['encounter', encounterId] }));
    }
  }, [detail.data, encounterId, qc]);

  const tindakanQ = useQuery({
    queryKey: ['tariffs', 'tindakan'],
    queryFn: async () => (await (await fetch('/api/tariffs?type=tindakan')).json()) as { data: Tariff[] },
  });

  const enc = detail.data?.data;

  if (detail.isLoading) return <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="skel h-24" />)}</div>;
  if (detail.isError || !enc) return <div className="card card-pad">Kunjungan tidak ditemukan.</div>;

  return (
    <div className="fade-in flex flex-col gap-3.5">
      <PatientHeader enc={enc} />

      <div className="grid grid-cols-1 md:grid-cols-[1.7fr_1fr] gap-4 items-start">
        <Encounter
          enc={enc}
          tindakan={tindakanQ.data?.data ?? []}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['encounter', encounterId] }); pushToast('success', 'Vital sign tersimpan'); }}
          onFinished={() => {
            pushToast('success', 'Pemeriksaan selesai — resep dikirim ke apotek & kasir');
            setTimeout(() => router.push('/antrian'), 800);
          }}
          onError={(m) => pushToast('info', m)}
        />
        <div className="card card-pad">
          <h2 className="h2 mb-3">Riwayat Kunjungan</h2>
          <History items={enc.history} />
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-24 md:bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none px-4">
          <Toast kind={toast.kind}>{toast.msg}</Toast>
        </div>
      )}
    </div>
  );
}

function PatientHeader({ enc }: { enc: Encounter }) {
  const p = enc.patient;
  const age = p.dob ? new Date().getFullYear() - new Date(p.dob).getFullYear() : '—';
  return (
    <div className="card card-pad flex items-center gap-3.5 flex-wrap">
      <Avatar name={p.name} size={52} />
      <div className="flex-1 min-w-[160px]">
        <div className="flex items-center gap-2 flex-wrap">
          <strong className="text-[17px]">{p.name}</strong>
          <PenjaminBadge jenis={p.penjamin} sm />
          <span className="badge b-gray mono">{enc.queueNo}</span>
        </div>
        <div className="muted mono text-[12.5px] mt-0.5">
          {p.rmNumber} · {age} th · {p.sex === 'L' ? 'L' : 'P'}
        </div>
      </div>
      {p.allergies && p.allergies !== '—' && (
        <div className="badge b-red" style={{ padding: '7px 12px' }}>
          <AlertTriangle size={14} /> Alergi: {p.allergies}
        </div>
      )}
      <SatuSehatBadge status={enc.syncStatus} />
    </div>
  );
}

function Encounter({
  enc, tindakan, onSaved, onFinished, onError,
}: {
  enc: Encounter; tindakan: Tariff[];
  onSaved: () => void; onFinished: () => void; onError: (m: string) => void;
}) {
  const initialVital = enc.vital ?? { td: '', nadi: '', suhu: '', rr: '', spo2: '', bb: '', tb: '' };
  const [v, setV] = React.useState({
    td: initialVital.td ?? '', nadi: String(initialVital.nadi ?? ''),
    suhu: String(initialVital.suhu ?? ''), rr: String(initialVital.rr ?? ''),
    spo2: String(initialVital.spo2 ?? ''), bb: String(initialVital.bb ?? ''), tb: String(initialVital.tb ?? ''),
  });
  const [soap, setSoap] = React.useState({ s: enc.complaint ?? '', o: '', a: '', p: '' });
  const [dx, setDx] = React.useState<Icd[]>([]);
  const [rx, setRx] = React.useState<{ drugId: string; drugName: string; drugKind: string; qty: number; signa: string }[]>([]);
  const [tind, setTind] = React.useState<string[]>([]);
  const [icdOpen, setIcdOpen] = React.useState(false);
  const [rxOpen, setRxOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const canFinish = dx.length > 0 && soap.a.trim().length > 0 && !busy;

  const saveVitals = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/encounters/${enc.id}/vitals`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v),
      });
      if (!r.ok) throw new Error((await r.json())?.error?.message ?? 'Gagal menyimpan vital');
      onSaved();
    } catch (e) { onError((e as Error).message); }
    finally { setBusy(false); }
  };

  const finish = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/encounters/${enc.id}/rme`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          soap,
          diagnoses: dx.map((d, i) => ({ icd10Code: d.code, icd10Name: d.name, isPrimary: i === 0 })),
          procedureTariffIds: tind,
          prescription: rx.length ? { items: rx.map((r) => ({ drugId: r.drugId, qty: r.qty, signa: r.signa })) } : undefined,
        }),
      });
      if (!r.ok) throw new Error((await r.json())?.error?.message ?? 'Gagal menyelesaikan kunjungan');
      onFinished();
    } catch (e) { onError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* Vital signs */}
      <div className="card card-pad">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="h3">Tanda Vital</h3>
          <div className="flex items-center gap-2">
            <span className="muted text-[11.5px]">{enc.vital ? 'tersimpan' : 'belum diinput'}</span>
            <button className="btn btn-sm btn-soft" onClick={saveVitals} disabled={busy}>Simpan vital</button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <VitalInput label="Tek. darah" k="td" unit="mmHg" Icon={Heart} value={v.td} onChange={(x) => setV({ ...v, td: x })} placeholder="120/80" />
          <VitalInput label="Nadi" k="nadi" unit="/mnt" Icon={Activity} value={v.nadi} onChange={(x) => setV({ ...v, nadi: x })} />
          <VitalInput label="Suhu" k="suhu" unit="°C" Icon={Thermometer} value={v.suhu} onChange={(x) => setV({ ...v, suhu: x })} />
          <VitalInput label="Resp." k="rr" unit="/mnt" value={v.rr} onChange={(x) => setV({ ...v, rr: x })} />
          <VitalInput label="SpO₂" k="spo2" unit="%" Icon={Droplet} value={v.spo2} onChange={(x) => setV({ ...v, spo2: x })} />
          <VitalInput label="Berat" k="bb" unit="kg" value={v.bb} onChange={(x) => setV({ ...v, bb: x })} />
          <VitalInput label="Tinggi" k="tb" unit="cm" value={v.tb} onChange={(x) => setV({ ...v, tb: x })} />
        </div>
      </div>

      {/* SOAP */}
      <div className="card card-pad">
        <h3 className="h3 mb-3">Anamnesis & Pemeriksaan (SOAP)</h3>
        <div className="flex flex-col gap-2.5">
          {([
            ['s', 'S — Subjektif', 'Keluhan pasien…'],
            ['o', 'O — Objektif', 'Hasil pemeriksaan fisik…'],
            ['a', 'A — Assessment', 'Penilaian klinis…'],
            ['p', 'P — Plan', 'Rencana tata laksana…'],
          ] as const).map(([k, l, ph]) => (
            <div key={k} className="field">
              <label className="label">{l}</label>
              <textarea
                className="textarea"
                style={{ minHeight: 56 }}
                placeholder={ph}
                value={soap[k]}
                onChange={(e) => setSoap({ ...soap, [k]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ICD-10 */}
      <div className="card card-pad">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="h3">Diagnosis (ICD-10)</h3>
          <button className="btn btn-sm btn-soft" onClick={() => setIcdOpen(true)}>
            <Plus size={14} /> Tambah
          </button>
        </div>
        {dx.length === 0 ? (
          <div className="muted text-[13px]">Belum ada diagnosis. Wajib diisi sebelum menyelesaikan.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dx.map((d) => (
              <span key={d.code} className="badge b-teal" style={{ padding: '7px 10px', fontSize: 13 }}>
                <strong className="mono">{d.code}</strong> {d.name}
                <button
                  onClick={() => setDx(dx.filter((x) => x.code !== d.code))}
                  className="ml-1 cursor-pointer"
                  aria-label="Hapus"
                  style={{ background: 'transparent', border: 'none', padding: 0 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Resep */}
      <div className="card card-pad">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="h3">Resep Obat</h3>
          <button className="btn btn-sm btn-soft" onClick={() => setRxOpen(true)}>
            <Pill size={14} /> Tambah obat
          </button>
        </div>
        {rx.length === 0 ? (
          <div className="muted text-[13px]">Belum ada obat diresepkan.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {rx.map((r, i) => (
              <div key={i} className="flex items-center gap-2.5 px-2.5 py-2 rounded-[10px]" style={{ background: 'var(--surface-2)' }}>
                <div className="w-[30px] h-[30px] rounded-lg grid place-items-center flex-none" style={{ background: 'var(--teal-tint)', color: 'var(--teal-600)' }}>
                  <Pill size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <strong className="text-[13.5px]">{r.drugName}</strong>
                  <div className="muted text-[12px]">{r.qty} {r.drugKind.toLowerCase()} · {r.signa}</div>
                </div>
                <button onClick={() => setRx(rx.filter((_, j) => j !== i))} className="muted" aria-label="Hapus" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tindakan */}
      <div className="card card-pad">
        <h3 className="h3 mb-2.5">Tindakan</h3>
        <div className="flex flex-wrap gap-2">
          {tindakan.map((t) => {
            const on = tind.includes(t.id);
            return (
              <button
                key={t.id}
                className={`badge ${on ? 'b-teal' : 'b-gray'}`}
                style={{ cursor: 'pointer', padding: '7px 11px', fontSize: 12.5 }}
                onClick={() => setTind(on ? tind.filter((x) => x !== t.id) : [...tind, t.id])}
              >
                {on && <Check size={13} />} {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Finish */}
      <div className="card card-pad flex items-center gap-2.5 flex-wrap md:sticky md:bottom-2">
        <div className="flex-1 text-[12.5px] muted">
          {canFinish
            ? 'Resep akan dikirim ke apotek & tagihan otomatis ke kasir.'
            : 'Lengkapi diagnosis & assessment untuk menyelesaikan.'}
        </div>
        <button className="btn btn-primary" disabled={!canFinish} onClick={finish}>
          <CheckCircle2 size={17} /> Selesai & Kirim
        </button>
      </div>

      {icdOpen && (
        <IcdPicker
          onClose={() => setIcdOpen(false)}
          onPick={(d) => { if (!dx.find((x) => x.code === d.code)) setDx([...dx, d]); setIcdOpen(false); }}
        />
      )}
      {rxOpen && (
        <RxPicker
          onClose={() => setRxOpen(false)}
          onAdd={(item) => { setRx([...rx, item]); setRxOpen(false); }}
        />
      )}
    </div>
  );
}

function VitalInput({
  label, k, unit, Icon, value, onChange, placeholder,
}: {
  label: string; k: string; unit?: string; Icon?: LucideIcon;
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="rounded-[10px] px-2.5 py-2" style={{ background: 'var(--surface-2)' }}>
      <div className="flex items-center gap-1 muted text-[11px] font-semibold mb-0.5">
        {Icon && <Icon size={12} />} {label}
      </div>
      <div className="flex items-center gap-1">
        <input
          className="input mono"
          style={{ padding: '5px 8px', minHeight: 32, fontWeight: 700, fontSize: 14 }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || '—'}
        />
        {unit && <span className="muted text-[11px]">{unit}</span>}
      </div>
    </div>
  );
}

function IcdPicker({ onClose, onPick }: { onClose: () => void; onPick: (d: Icd) => void }) {
  const [q, setQ] = React.useState('');
  const list = useQuery({
    queryKey: ['icd10', q],
    queryFn: async () => (await (await fetch(`/api/icd10?q=${encodeURIComponent(q)}`)).json()) as { data: Icd[] },
    placeholderData: (p) => p,
  });
  return (
    <Modal title="Cari Diagnosis ICD-10" onClose={onClose}>
      <div className="input-icon mb-3">
        <Search size={18} />
        <input className="input" placeholder="Kode atau nama penyakit…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      <div className="flex flex-col gap-1.5" style={{ maxHeight: 320, overflowY: 'auto' }}>
        {(list.data?.data ?? []).map((d) => (
          <button
            key={d.code}
            onClick={() => onPick(d)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-left w-full"
            style={{ background: 'var(--surface-2)', border: 'none', cursor: 'pointer' }}
          >
            <span className="badge b-teal mono" style={{ minWidth: 54, justifyContent: 'center' }}>{d.code}</span>
            <span className="text-[13.5px]">{d.name}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function RxPicker({
  onClose, onAdd,
}: {
  onClose: () => void;
  onAdd: (i: { drugId: string; drugName: string; drugKind: string; qty: number; signa: string }) => void;
}) {
  const [q, setQ] = React.useState('');
  const drugsQ = useQuery({
    queryKey: ['drugs', q],
    queryFn: async () => (await (await fetch(`/api/drugs?q=${encodeURIComponent(q)}`)).json()) as { data: Drug[] },
    placeholderData: (p) => p,
  });
  const drugs = drugsQ.data?.data ?? [];
  const [drugId, setDrugId] = React.useState<string>('');
  const [qty, setQty] = React.useState(10);
  const [signa, setSigna] = React.useState('3x1 sesudah makan');
  React.useEffect(() => { if (!drugId && drugs[0]) setDrugId(drugs[0].id); }, [drugs, drugId]);
  const d = drugs.find((x) => x.id === drugId);
  const valid = !!d && qty > 0 && signa.trim().length > 0;

  return (
    <Modal
      title="Tambah Obat ke Resep"
      onClose={onClose}
      footer={
        <button
          className="btn btn-primary"
          disabled={!valid}
          onClick={() => d && onAdd({ drugId: d.id, drugName: d.name, drugKind: d.kind, qty: Number(qty), signa })}
        >
          Tambah ke resep
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="input-icon">
          <Search size={18} />
          <input className="input" placeholder="Cari obat…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="field">
          <label className="label">Obat</label>
          <select className="select" value={drugId} onChange={(e) => setDrugId(e.target.value)}>
            {drugs.map((x) => (
              <option key={x.id} value={x.id}>{x.name} (stok {x.stock})</option>
            ))}
          </select>
        </div>
        {d && d.stock < d.minStock && (
          <div className="badge b-red self-start" style={{ padding: '6px 10px' }}>
            <AlertTriangle size={13} /> Stok menipis: {d.stock} tersisa
          </div>
        )}
        <div className="grid grid-cols-[1fr_2fr] gap-2.5">
          <div className="field">
            <label className="label">Jumlah</label>
            <input className="input mono" type="number" value={qty} min={1} onChange={(e) => setQty(Number(e.target.value))} />
          </div>
          <div className="field">
            <label className="label">Signa / aturan pakai</label>
            <input className="input" value={signa} onChange={(e) => setSigna(e.target.value)} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function History({ items }: { items: Encounter['history'] }) {
  if (!items?.length) return <EmptyState icon={FileText} title="Belum ada riwayat" sub="Kunjungan sebelumnya akan muncul di sini." />;
  return (
    <div className="flex flex-col">
      {items.map((v, i) => (
        <div key={v.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              style={{
                width: 11, height: 11, borderRadius: '50%',
                background: i === 0 ? 'var(--teal-500)' : 'var(--line)',
                border: '2px solid var(--surface)',
                marginTop: 4,
              }}
            />
            {i < items.length - 1 && <div className="flex-1" style={{ width: 2, background: 'var(--line)', minHeight: 30 }} />}
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <strong className="mono text-[13px]">{formatTanggal(v.finishedAt)}</strong>
              <span className="badge b-gray mono" style={{ fontSize: 11 }}>{v.queueNo}</span>
            </div>
            {v.a && <div className="text-[13px] font-semibold mt-0.5">{v.a}</div>}
            {v.s && <div className="muted text-[12px] mt-0.5">{v.s}</div>}
            <div className="muted text-[11.5px] mt-1">{v.doctorName}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
