'use client';
import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pill, Check, AlertTriangle, Clock } from 'lucide-react';
import { Avatar, EmptyState, Toast } from '@/components/ui/primitives';
import { formatJam, formatRp } from '@/lib/utils';

type Prescription = {
  id: string;
  status: 'masuk' | 'disiapkan' | 'diserahkan' | 'batal';
  createdAt: string;
  patient: { id: string; name: string; rmNumber: string; penjamin: 'BPJS' | 'Umum' | 'Asuransi' };
  items: {
    id: string; qty: number; signa: string; priceSnapshot: string;
    drug: { id: string; name: string; kind: string; stock: number; minStock: number; price: string };
  }[];
};

type Drug = { id: string; name: string; kind: string; stock: number; minStock: number; price: string; expiry: string | null };

export function FarmasiClient() {
  const [tab, setTab] = React.useState<'resep' | 'stok'>('resep');
  const [toast, setToast] = React.useState<{ kind: 'info' | 'success'; msg: string } | null>(null);
  const pushToast = (k: 'info' | 'success', m: string) => { setToast({ kind: k, msg: m }); setTimeout(() => setToast(null), 3200); };

  return (
    <div className="fade-in flex flex-col gap-3.5">
      <div>
        <h1 className="h1">Farmasi / Apotek</h1>
        <div className="muted text-[13.5px] mt-0.5">
          Resep masuk & stok real-time. Stok terpotong otomatis saat obat diserahkan.
        </div>
      </div>
      <div className="seg w-fit">
        {([['resep', 'Resep Masuk'], ['stok', 'Stok Obat']] as const).map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'resep' ? <RxQueue onToast={pushToast} /> : <StockTable />}

      {toast && (
        <div className="fixed bottom-24 md:bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none px-4">
          <Toast kind={toast.kind}>{toast.msg}</Toast>
        </div>
      )}
    </div>
  );
}

function RxQueue({ onToast }: { onToast: (k: 'info' | 'success', m: string) => void }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['prescriptions'],
    queryFn: async () => (await (await fetch('/api/prescriptions')).json()) as { data: Prescription[] },
    refetchInterval: 5000,
  });

  const prep = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/prescriptions/${id}/prep`, { method: 'POST' });
      if (!r.ok) throw new Error((await r.json())?.error?.message ?? 'Gagal menyiapkan');
      return r.json();
    },
    onSuccess: () => { onToast('success', 'Resep sedang disiapkan'); qc.invalidateQueries({ queryKey: ['prescriptions'] }); },
    onError: (e: Error) => onToast('info', e.message),
  });
  const dispense = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/prescriptions/${id}/dispense`, { method: 'POST' });
      if (!r.ok) throw new Error((await r.json())?.error?.message ?? 'Gagal menyerahkan');
      return r.json();
    },
    onSuccess: () => { onToast('success', 'Obat diserahkan — stok terpotong, tagihan terupdate'); qc.invalidateQueries({ queryKey: ['prescriptions'] }); },
    onError: (e: Error) => onToast('info', e.message),
  });

  const items = list.data?.data ?? [];
  if (list.isLoading) return <div className="space-y-2">{[1,2].map((i) => <div key={i} className="skel h-40" />)}</div>;
  if (!items.length) return <EmptyState icon={Pill} title="Tidak ada resep" sub="Resep dari dokter akan muncul di sini." />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
      {items.map((r) => {
        const total = r.items.reduce((s, i) => s + Number(i.priceSnapshot) * i.qty, 0);
        return (
          <div key={r.id} className="card card-pad flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Avatar name={r.patient.name} size={38} />
                <div>
                  <strong className="text-[14px]">{r.patient.name}</strong>
                  <div className="muted mono text-[12px]">masuk {formatJam(r.createdAt)}</div>
                </div>
              </div>
              <span className={`badge ${r.status === 'masuk' ? 'b-amber' : r.status === 'disiapkan' ? 'b-sky' : 'b-green'}`}>
                {r.status === 'masuk' ? 'Baru' : r.status === 'disiapkan' ? 'Disiapkan' : 'Diserahkan'}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {r.items.map((i) => {
                const low = i.drug.stock < i.qty;
                return (
                  <div
                    key={i.id}
                    className="flex items-center justify-between text-[13px] px-2.5 py-1.5 rounded-lg"
                    style={{ background: 'var(--surface-2)' }}
                  >
                    <div>
                      <strong>{i.drug.name}</strong>
                      <div className="muted text-[11.5px]">{i.signa}</div>
                    </div>
                    <div className="text-right">
                      <div className="mono font-bold">×{i.qty}</div>
                      {low && <span className="badge b-red" style={{ fontSize: 10 }}>stok kurang</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="muted mono text-[13px]">{formatRp(total)}</span>
              <div className="flex items-center gap-2">
                {r.status === 'masuk' && (
                  <button className="btn btn-sm btn-ghost" onClick={() => prep.mutate(r.id)} disabled={prep.isPending}>
                    Siapkan
                  </button>
                )}
                {r.status !== 'diserahkan' && r.status !== 'batal' && (
                  <button className="btn btn-sm btn-primary" onClick={() => dispense.mutate(r.id)} disabled={dispense.isPending}>
                    <Check size={14} /> Serahkan
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StockTable() {
  const list = useQuery({
    queryKey: ['drugs', 'all'],
    queryFn: async () => (await (await fetch('/api/drugs')).json()) as { data: Drug[] },
  });
  const drugs = list.data?.data ?? [];
  const low = drugs.filter((d) => d.stock < d.minStock);
  const expSoon = drugs.filter((d) => {
    if (!d.expiry) return false;
    const exp = new Date(d.expiry);
    const days = (exp.getTime() - Date.now()) / 86400_000;
    return days > 0 && days < 180;
  });

  if (list.isLoading) return <div className="skel h-64" />;

  return (
    <div className="flex flex-col gap-3">
      {(low.length > 0 || expSoon.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {low.length > 0 && (
            <div className="card card-pad" style={{ background: 'var(--red-tint)', borderColor: 'var(--red-bg)' }}>
              <div className="flex items-center gap-2 font-bold text-[13.5px]" style={{ color: 'var(--red)' }}>
                <AlertTriangle size={17} /> {low.length} obat di bawah stok minimum
              </div>
              <div className="muted text-[12.5px] mt-1">{low.map((d) => d.name).join(', ')}</div>
            </div>
          )}
          {expSoon.length > 0 && (
            <div className="card card-pad" style={{ background: 'var(--amber-tint)', borderColor: 'var(--amber-bg)' }}>
              <div className="flex items-center gap-2 font-bold text-[13.5px]" style={{ color: 'var(--amber)' }}>
                <Clock size={17} /> {expSoon.length} obat mendekati kedaluwarsa
              </div>
              <div className="muted text-[12.5px] mt-1">
                {expSoon.map((d) => `${d.name} (${d.expiry?.slice(0, 7)})`).join(', ')}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="card overflow-x-auto" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr><th>Obat</th><th>Jenis</th><th>Stok</th><th className="hidden md:table-cell">Harga</th><th>Kedaluwarsa</th><th>Status</th></tr>
          </thead>
          <tbody>
            {drugs.map((d) => {
              const isLow = d.stock < d.minStock;
              return (
                <tr key={d.id}>
                  <td><strong>{d.name}</strong></td>
                  <td className="muted">{d.kind}</td>
                  <td className="mono font-bold" style={{ color: isLow ? 'var(--red)' : undefined }}>{d.stock}</td>
                  <td className="mono hidden md:table-cell">{formatRp(d.price)}</td>
                  <td className="mono muted">{d.expiry?.slice(0, 7) ?? '—'}</td>
                  <td>{isLow ? <span className="badge b-red">Menipis</span> : <span className="badge b-green">Aman</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
