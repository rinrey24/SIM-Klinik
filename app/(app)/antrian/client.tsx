'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Check, Smartphone, Activity } from 'lucide-react';
import { Avatar, PenjaminBadge, QueueBadge, EmptyState, Toast } from '@/components/ui/primitives';
import { formatJam } from '@/lib/utils';

type Role = 'admin' | 'pendaftaran' | 'dokter' | 'perawat' | 'apoteker' | 'kasir';

type Encounter = {
  id: string;
  queueNo: string;
  status: 'menunggu' | 'dipanggil' | 'dilayani' | 'selesai' | 'batal';
  complaint: string | null;
  arrivedAt: string;
  syncStatus: 'menunggu' | 'tersinkron' | 'gagal';
  patient: { id: string; name: string; rmNumber: string; penjamin: 'BPJS' | 'Umum' | 'Asuransi' };
  doctor: { id: string; name: string };
};

export function AntrianClient({ role }: { role: Role }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [toast, setToast] = React.useState<{ kind: 'info' | 'success'; msg: string } | null>(null);
  const pushToast = (kind: 'info' | 'success', msg: string) => {
    setToast({ kind, msg }); setTimeout(() => setToast(null), 3200);
  };

  const list = useQuery({
    queryKey: ['encounters', 'today'],
    queryFn: async () => {
      const r = await fetch('/api/encounters');
      if (!r.ok) throw new Error('Gagal memuat antrian');
      return (await r.json()) as { data: Encounter[] };
    },
    refetchInterval: 5000,
  });

  const setStatus = useMutation({
    mutationFn: async (v: { id: string; status: Encounter['status']; resetOther?: boolean }) => {
      const r = await fetch(`/api/encounters/${v.id}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: v.status }),
      });
      if (!r.ok) throw new Error((await r.json())?.error?.message ?? 'Gagal mengubah status');
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['encounters', 'today'] }),
    onError: (e: Error) => pushToast('info', e.message),
  });

  const items = list.data?.data ?? [];
  const menunggu = items.filter((x) => x.status === 'menunggu');
  const dipanggilExisting = items.find((x) => x.status === 'dipanggil');
  const selesai = items.filter((x) => x.status === 'selesai');
  const active = items.filter((x) => x.status !== 'selesai' && x.status !== 'batal');
  const serving = items.find((x) => x.status === 'dipanggil') ?? items.find((x) => x.status === 'dilayani');
  const next = menunggu[0];

  const callNext = async () => {
    if (!next) { pushToast('info', 'Tidak ada pasien menunggu'); return; }
    if (dipanggilExisting && dipanggilExisting.id !== next.id) {
      await setStatus.mutateAsync({ id: dipanggilExisting.id, status: 'menunggu' });
    }
    await setStatus.mutateAsync({ id: next.id, status: 'dipanggil' });
    pushToast('success', `Memanggil ${next.queueNo}`);
  };

  const advance = async (item: Encounter) => {
    if (role === 'dokter' || role === 'admin') {
      router.push(`/rme/${item.id}`);
    } else if (role === 'perawat') {
      await setStatus.mutateAsync({ id: item.id, status: 'dilayani' });
      pushToast('success', `${item.queueNo} masuk asesmen`);
    }
  };

  return (
    <div className="fade-in flex flex-col gap-4">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <h1 className="h1">Antrian — Poli Umum</h1>
          <div className="muted text-[13.5px] mt-0.5">
            {menunggu.length} menunggu · {selesai.length} selesai hari ini
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={callNext}
          disabled={!next || setStatus.isPending}
        >
          <Megaphone size={18} />
          <span className="hidden md:inline">Panggil Berikutnya</span>
          <span className="md:hidden">Panggil</span>
          {next && (
            <span className="mono" style={{ background: 'rgba(255,255,255,.2)', borderRadius: 6, padding: '2px 7px', fontSize: 12 }}>
              {next.queueNo}
            </span>
          )}
        </button>
      </div>

      {serving && (
        <div
          className="card flex items-center gap-4"
          style={{ padding: 18, background: 'linear-gradient(135deg, var(--teal-700), var(--teal-600))', color: '#fff', border: 'none' }}
        >
          <div className="text-center">
            <div style={{ fontSize: 11, opacity: .8, fontWeight: 700, letterSpacing: '.06em' }}>
              {serving.status === 'dipanggil' ? 'DIPANGGIL' : 'SEDANG DILAYANI'}
            </div>
            <div className="mono" style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>{serving.queueNo}</div>
          </div>
          <div style={{ width: 1, height: 44, background: 'rgba(255,255,255,.25)' }} />
          <div className="flex-1 min-w-0">
            <div className="font-extrabold text-[17px] truncate">{serving.patient.name}</div>
            <div className="opacity-90 text-[13px] truncate">{serving.complaint || 'Tanpa keluhan tercatat'}</div>
          </div>
          {serving.status === 'dipanggil' && (
            <span className="dot pulse" style={{ width: 12, height: 12, background: '#fff' }} />
          )}
        </div>
      )}

      <div
        className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
        style={{ border: '1.5px dashed var(--line)', background: 'var(--surface-2)' }}
      >
        <Smartphone size={18} className="muted" />
        <div className="flex-1 text-[12.5px]">
          <strong>Antrian online pasien</strong>
          <span className="muted"> — slot pendaftaran mandiri via WhatsApp/web akan muncul di sini.</span>
        </div>
        <span className="badge b-gray">Segera</span>
      </div>

      {list.isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="skel h-16" />)}</div>
      ) : active.length === 0 && selesai.length === 0 ? (
        <EmptyState icon={Check} title="Antrian kosong" sub="Belum ada kunjungan hari ini." />
      ) : (
        <div className="flex flex-col gap-2">
          {active.length === 0 && (
            <EmptyState icon={Check} title="Tidak ada antrian aktif" sub="Semua pasien telah dilayani." />
          )}
          {active.map((item) => <Item key={item.id} item={item} role={role} onAdvance={() => advance(item)} />)}
          {selesai.length > 0 && <div className="eyebrow mt-2">Selesai hari ini</div>}
          {selesai.map((item) => (
            <div key={item.id} style={{ opacity: .6 }}>
              <Item item={item} role={role} onAdvance={() => advance(item)} />
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 md:bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none px-4">
          <Toast kind={toast.kind}>{toast.msg}</Toast>
        </div>
      )}
    </div>
  );
}

function Item({ item, role, onAdvance }: { item: Encounter; role: Role; onAdvance: () => void }) {
  return (
    <div className="card flex items-center gap-3" style={{ padding: 12, boxShadow: 'none' }}>
      <div style={{ width: 46, textAlign: 'center', flex: 'none' }}>
        <div className="mono" style={{ fontWeight: 800, fontSize: 16, color: 'var(--teal-600)' }}>{item.queueNo}</div>
        <div className="muted mono" style={{ fontSize: 10 }}>{formatJam(item.arrivedAt)}</div>
      </div>
      <Avatar name={item.patient.name} size={38} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <strong className="text-[14px] truncate">{item.patient.name}</strong>
          <PenjaminBadge jenis={item.patient.penjamin} sm />
        </div>
        <div className="muted text-[12px] truncate">{item.complaint || '—'}</div>
      </div>
      <div className="flex items-center gap-1.5">
        <QueueBadge status={item.status} />
        {(item.status === 'dipanggil' || item.status === 'dilayani') && (role === 'dokter' || role === 'admin') && (
          <button className="btn btn-sm btn-soft" onClick={onAdvance}>Periksa</button>
        )}
        {item.status === 'menunggu' && role === 'perawat' && (
          <button className="btn btn-sm btn-soft" onClick={onAdvance}>Asesmen</button>
        )}
      </div>
    </div>
  );
}
