'use client';
import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, MessageCircle, Info, Calendar, AlertTriangle } from 'lucide-react';
import { EmptyState, Modal, Toast } from '@/components/ui/primitives';
import { formatJam } from '@/lib/utils';

type Doctor = { id: string; name: string; sip: string | null };
type Appointment = {
  id: string; scheduledAt: string; note: string | null;
  status: 'terjadwal' | 'selesai' | 'batal';
  doctor: { id: string; name: string };
  patient: { id: string; name: string; phone: string | null; rmNumber: string } | null;
};

export function JadwalClient() {
  const qc = useQueryClient();
  const today = new Date();
  const [date, setDate] = React.useState(() => today.toISOString().slice(0, 10));
  const [docId, setDocId] = React.useState<string>('');
  const [openCreate, setOpenCreate] = React.useState<{ defaultTime?: string } | null>(null);
  const [toast, setToast] = React.useState<{ kind: 'info' | 'success'; msg: string } | null>(null);
  const pushToast = (k: 'info' | 'success', m: string) => { setToast({ kind: k, msg: m }); setTimeout(() => setToast(null), 3200); };

  const doctors = useQuery({
    queryKey: ['doctors'],
    queryFn: async () => (await (await fetch('/api/doctors')).json()) as { data: Doctor[] },
  });
  React.useEffect(() => {
    if (!docId && doctors.data?.data?.[0]) setDocId(doctors.data.data[0].id);
  }, [doctors.data, docId]);

  const list = useQuery({
    queryKey: ['appointments', date, docId],
    queryFn: async () => {
      const u = new URL('/api/appointments', window.location.origin);
      u.searchParams.set('date', date);
      if (docId) u.searchParams.set('doctorId', docId);
      return (await (await fetch(u)).json()) as { data: Appointment[] };
    },
    enabled: !!docId,
  });

  const items = list.data?.data ?? [];
  // Generate slot 08.00 – 17.00 per jam
  const slots = React.useMemo(() => {
    const base = new Date(date + 'T00:00:00');
    const out: { time: string; hour: number; appt?: Appointment }[] = [];
    for (let h = 8; h <= 17; h++) {
      const at = new Date(base); at.setHours(h, 0, 0, 0);
      const appt = items.find((a) => new Date(a.scheduledAt).getHours() === h && a.status !== 'batal');
      out.push({ time: `${String(h).padStart(2, '0')}.00`, hour: h, appt });
    }
    return out;
  }, [items, date]);

  const create = useMutation({
    mutationFn: async (v: { patientName: string; patientPhone: string; hour: number; note: string }) => {
      const at = new Date(date + 'T00:00:00');
      at.setHours(v.hour, 0, 0, 0);
      // Quick patient lookup or create not built — minimal: use existing patient by phone, else just no patient (anonymous)
      let patientId: string | undefined;
      if (v.patientName && v.patientPhone) {
        const pq = await fetch(`/api/patients?q=${encodeURIComponent(v.patientPhone)}&limit=5`);
        const pData = (await pq.json()) as { data: { id: string; phone: string | null; name: string }[] };
        const found = pData.data.find((x) => x.phone === v.patientPhone || x.name === v.patientName);
        if (found) patientId = found.id;
      }
      const r = await fetch('/api/appointments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId: docId, patientId, scheduledAt: at.toISOString(), note: v.note }),
      });
      if (!r.ok) throw new Error((await r.json())?.error?.message ?? 'Gagal membuat janji');
      return r.json();
    },
    onSuccess: () => {
      pushToast('success', 'Janji temu dibuat — pengingat WhatsApp akan dikirim');
      qc.invalidateQueries({ queryKey: ['appointments'] });
      setOpenCreate(null);
    },
    onError: (e: Error) => pushToast('info', e.message),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json())?.error?.message ?? 'Gagal membatalkan');
      return r.json();
    },
    onSuccess: () => {
      pushToast('success', 'Janji temu dibatalkan');
      qc.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (e: Error) => pushToast('info', e.message),
  });

  return (
    <div className="fade-in flex flex-col gap-3.5">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="h1">Jadwal & Janji Temu</h1>
          <div className="muted text-[13.5px] mt-0.5">
            Klik slot kosong untuk membuat janji baru. Pengingat WhatsApp dikirim H-1 & 2 jam sebelumnya.
          </div>
        </div>
        <div className="input-icon">
          <Calendar size={16} />
          <input type="date" className="input" style={{ paddingLeft: 36 }} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(doctors.data?.data ?? []).map((d) => {
          const on = docId === d.id;
          return (
            <button
              key={d.id}
              onClick={() => setDocId(d.id)}
              className="btn btn-sm"
              style={{
                border: `1.5px solid ${on ? 'var(--teal-500)' : 'var(--line)'}`,
                background: on ? 'var(--teal-tint)' : 'var(--surface)',
                color: on ? 'var(--teal-700)' : 'var(--ink-2)',
              }}
            >
              <span className="dot dot-green" />
              {d.name}
            </button>
          );
        })}
      </div>

      <div className="card overflow-hidden" style={{ padding: 0 }}>
        {list.isLoading ? (
          <div className="p-4 space-y-2">{[1,2,3].map((i) => <div key={i} className="skel h-12" />)}</div>
        ) : (
          slots.map((slot) => (
            <div
              key={slot.hour}
              className="flex items-center gap-3.5 px-4 py-3 border-b transition-colors hover:bg-[var(--surface-2)]"
              style={{ borderColor: 'var(--line-2)', cursor: slot.appt ? 'default' : 'pointer', opacity: slot.appt ? 1 : .85 }}
              onClick={() => !slot.appt && setOpenCreate({ defaultTime: slot.time })}
            >
              <span className="mono" style={{ fontWeight: 800, fontSize: 15, color: 'var(--teal-600)', width: 50 }}>
                {slot.time}
              </span>
              <div className="flex-1 min-w-0">
                {!slot.appt ? (
                  <span className="muted text-[13.5px]">+ Slot tersedia — buat janji</span>
                ) : (
                  <>
                    <strong className="text-[14px]">{slot.appt.patient?.name ?? '— tanpa nama'}</strong>
                    {slot.appt.note && <div className="muted text-[12px]">{slot.appt.note}</div>}
                  </>
                )}
              </div>
              {!slot.appt ? (
                <Plus size={18} className="muted" />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="badge b-sky"><MessageCircle size={12} /> Diingatkan</span>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={(e) => { e.stopPropagation(); if (confirm('Batalkan janji temu?')) cancel.mutate(slot.appt!.id); }}
                  >
                    Batal
                  </button>
                </div>
              )}
            </div>
          ))
        )}
        <div className="flex items-center gap-2 px-4 py-3 muted text-[12.5px]" style={{ background: 'var(--surface-2)' }}>
          <Info size={15} />
          Pengingat WhatsApp otomatis dikirim H-1 & 2 jam sebelum janji temu.
        </div>
      </div>

      {openCreate && (
        <CreateForm
          defaultTime={openCreate.defaultTime}
          busy={create.isPending}
          onClose={() => setOpenCreate(null)}
          onSubmit={(v) => create.mutate(v)}
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
  defaultTime, busy, onClose, onSubmit,
}: {
  defaultTime?: string; busy: boolean;
  onClose: () => void;
  onSubmit: (v: { patientName: string; patientPhone: string; hour: number; note: string }) => void;
}) {
  const initialHour = defaultTime ? parseInt(defaultTime) : 9;
  const [patientName, setPatientName] = React.useState('');
  const [patientPhone, setPatientPhone] = React.useState('');
  const [hour, setHour] = React.useState(initialHour);
  const [note, setNote] = React.useState('');
  const valid = patientName.trim().length > 1;

  return (
    <Modal
      title="Buat Janji Temu"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Batal</button>
          <button
            className="btn btn-primary"
            disabled={!valid || busy}
            onClick={() => onSubmit({ patientName, patientPhone, hour, note })}
          >
            <Plus size={16} /> Simpan
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="field">
          <label className="label">Nama pasien</label>
          <input className="input" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="cth. Budi Santoso" />
        </div>
        <div className="field">
          <label className="label">No. HP (opsional, untuk WhatsApp)</label>
          <input className="input mono" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} placeholder="08xx" />
        </div>
        <div className="field">
          <label className="label">Waktu</label>
          <select className="select" value={hour} onChange={(e) => setHour(Number(e.target.value))}>
            {Array.from({ length: 10 }, (_, i) => 8 + i).map((h) => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}.00</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label">Catatan</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="cth. Kontrol gula darah" />
        </div>
        {patientName && !patientPhone && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-[10px] text-[12.5px]" style={{ background: 'var(--amber-tint)' }}>
            <AlertTriangle size={14} style={{ color: 'var(--amber)', flex: 'none', marginTop: 2 }} />
            <span className="muted">Tanpa nomor HP, pengingat WhatsApp tidak akan dikirim.</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
