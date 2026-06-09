'use client';
import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Receipt, ChevronLeft, Banknote, QrCode, CreditCard, Shield, CheckCircle2, Check, Printer, MessageCircle,
  type LucideIcon,
} from 'lucide-react';
import { Avatar, PenjaminBadge, EmptyState, Toast } from '@/components/ui/primitives';
import { formatJam, formatRp } from '@/lib/utils';

type Bill = {
  id: string;
  status: 'belum' | 'lunas' | 'batal';
  total: string;
  payMethod: 'tunai' | 'qris' | 'kartu' | 'bpjs' | null;
  paidAt: string | null;
  createdAt: string;
  encounterId: string;
  patient: { id: string; name: string; rmNumber: string; penjamin: 'BPJS' | 'Umum' | 'Asuransi'; phone: string | null; bpjsNumber?: string | null };
};

type BillDetail = Bill & {
  items: { id: string; label: string; qty: number; price: string; type: 'jasa' | 'tindakan' | 'obat' }[];
};

type Method = 'tunai' | 'qris' | 'kartu' | 'bpjs';

export function KasirClient() {
  const [selId, setSelId] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ kind: 'info' | 'success'; msg: string } | null>(null);
  const pushToast = (k: 'info' | 'success', m: string) => { setToast({ kind: k, msg: m }); setTimeout(() => setToast(null), 3200); };

  const list = useQuery({
    queryKey: ['bills'],
    queryFn: async () => (await (await fetch('/api/bills')).json()) as { data: Bill[] },
    refetchInterval: 8000,
  });

  React.useEffect(() => {
    if (!selId && list.data?.data?.[0]) setSelId(list.data.data[0].id);
  }, [list.data, selId]);

  const bills = list.data?.data ?? [];

  return (
    <div className="fade-in flex flex-col gap-3.5">
      <div>
        <h1 className="h1">Kasir & Pembayaran</h1>
        <div className="muted text-[13.5px] mt-0.5">
          Tagihan otomatis menggabungkan jasa dokter, tindakan, dan obat.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 items-start">
        <div className={`card overflow-hidden ${selId ? 'hidden md:block' : ''}`} style={{ padding: 0 }}>
          <div className="eyebrow px-4 pt-3.5 pb-2">Tagihan hari ini</div>
          {bills.length === 0 ? (
            <div className="p-2"><EmptyState icon={Receipt} title="Belum ada tagihan" /></div>
          ) : (
            bills.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelId(b.id)}
                className="flex items-center gap-2.5 px-4 py-3 border-t w-full text-left transition-colors"
                style={{
                  borderColor: 'var(--line-2)',
                  background: selId === b.id ? 'var(--teal-tint)' : 'transparent',
                }}
              >
                <Avatar name={b.patient.name} size={38} />
                <div className="flex-1 min-w-0">
                  <strong className="text-[13.5px]">{b.patient.name}</strong>
                  <div className="muted mono text-[12px]">{formatRp(b.total)}</div>
                </div>
                {b.status === 'lunas'
                  ? <span className="badge b-green">Lunas</span>
                  : <span className="badge b-amber">Belum</span>}
              </button>
            ))
          )}
        </div>

        <div className={`min-w-0 ${!selId ? 'hidden md:block' : ''}`}>
          {selId ? (
            <BillView id={selId} onBack={() => setSelId(null)} onToast={pushToast} />
          ) : (
            <div className="card card-pad">
              <EmptyState icon={Receipt} title="Pilih tagihan" sub="Pilih pasien di kiri untuk memproses pembayaran." />
            </div>
          )}
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

function BillView({ id, onBack, onToast }: { id: string; onBack: () => void; onToast: (k: 'info' | 'success', m: string) => void }) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ['bill', id],
    queryFn: async () => (await (await fetch(`/api/bills/${id}`)).json()) as { data: BillDetail },
  });
  const bill = detail.data?.data;

  const [method, setMethod] = React.useState<Method>('tunai');
  React.useEffect(() => {
    if (bill?.patient.penjamin === 'BPJS') setMethod('bpjs');
  }, [bill?.patient.penjamin]);

  const pay = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/bills/${id}/pay`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method }),
      });
      if (!r.ok) throw new Error((await r.json())?.error?.message ?? 'Gagal memproses pembayaran');
      return r.json();
    },
    onSuccess: () => {
      onToast('success', `Pembayaran lunas via ${method.toUpperCase()}`);
      qc.invalidateQueries({ queryKey: ['bill', id] });
      qc.invalidateQueries({ queryKey: ['bills'] });
    },
    onError: (e: Error) => onToast('info', e.message),
  });

  if (detail.isLoading || !bill) return <div className="skel h-64" />;

  const subtotal = bill.items.reduce((s, i) => s + Number(i.price) * i.qty, 0);
  const bpjsCover = method === 'bpjs' ? subtotal : 0;
  const due = subtotal - bpjsCover;

  if (bill.status === 'lunas') {
    return <NotaSuccess bill={bill} onBack={onBack} onToast={onToast} />;
  }

  const methods: { key: Method; label: string; Icon: LucideIcon }[] = [
    { key: 'tunai', label: 'Tunai', Icon: Banknote },
    { key: 'qris', label: 'QRIS', Icon: QrCode },
    { key: 'kartu', label: 'Kartu', Icon: CreditCard },
    { key: 'bpjs', label: 'BPJS', Icon: Shield },
  ];

  return (
    <div className="card overflow-hidden" style={{ padding: 0 }}>
      <button className="btn btn-sm btn-ghost m-3.5 mb-0 md:hidden" onClick={onBack}>
        <ChevronLeft size={16} /> Kembali
      </button>
      <div className="card-pad">
        <div className="flex items-center gap-3">
          <Avatar name={bill.patient.name} size={46} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <strong className="text-[16px]">{bill.patient.name}</strong>
              <PenjaminBadge jenis={bill.patient.penjamin} sm />
            </div>
            <div className="muted mono text-[12px]">{bill.patient.rmNumber} · {formatJam(bill.createdAt)}</div>
          </div>
        </div>
      </div>
      <hr className="divider" />
      <div className="card-pad flex flex-col gap-3.5">
        {(['jasa', 'tindakan', 'obat'] as const).map((g) => {
          const items = bill.items.filter((i) => i.type === g);
          if (!items.length) return null;
          const labels: Record<typeof g, string> = { jasa: 'Jasa & Konsultasi', tindakan: 'Tindakan Medis', obat: 'Obat & Farmasi' };
          return (
            <div key={g}>
              <div className="eyebrow mb-1.5">{labels[g]}</div>
              {items.map((i) => (
                <div key={i.id} className="flex justify-between py-1 text-[13.5px]">
                  <span>{i.label}{i.qty > 1 && <span className="muted mono">  ×{i.qty}</span>}</span>
                  <span className="mono font-semibold">{formatRp(Number(i.price) * i.qty)}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <hr className="divider" />
      <div className="card-pad flex flex-col gap-2">
        <div className="flex justify-between text-[13.5px]">
          <span className="muted">Subtotal</span>
          <span className="mono">{formatRp(subtotal)}</span>
        </div>
        {bpjsCover > 0 && (
          <div className="flex justify-between text-[13.5px]" style={{ color: 'var(--teal-600)' }}>
            <span>Ditanggung BPJS</span>
            <span className="mono">−{formatRp(bpjsCover)}</span>
          </div>
        )}
        <div className="flex justify-between mt-1">
          <strong className="text-[15px]">Total bayar</strong>
          <strong className="mono" style={{ fontSize: 22, color: 'var(--teal-600)' }}>{formatRp(due)}</strong>
        </div>
      </div>
      <hr className="divider" />
      <div className="card-pad">
        <div className="label mb-2">Metode pembayaran</div>
        <div className="grid grid-cols-4 gap-2 mb-3.5">
          {methods.map((m) => {
            const on = method === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setMethod(m.key)}
                className="btn flex-col gap-1.5"
                style={{
                  padding: '12px 6px', height: 'auto',
                  border: `1.5px solid ${on ? 'var(--teal-500)' : 'var(--line)'}`,
                  background: on ? 'var(--teal-tint)' : 'var(--surface)',
                  color: on ? 'var(--teal-700)' : 'var(--ink-2)',
                  minHeight: 'auto',
                }}
              >
                <m.Icon size={22} />
                <span className="text-[12px]">{m.label}</span>
              </button>
            );
          })}
        </div>
        {method === 'qris' && (
          <div
            className="text-center p-3 rounded-xl mb-3.5"
            style={{ background: 'var(--surface-2)' }}
          >
            <QrCode size={80} style={{ color: 'var(--ink)', margin: '0 auto' }} />
            <div className="muted text-[12px] mt-1">Scan untuk membayar {formatRp(due)}</div>
          </div>
        )}
        <button
          className="btn btn-primary btn-block"
          style={{ fontSize: 15, padding: 13 }}
          onClick={() => pay.mutate()}
          disabled={pay.isPending}
        >
          <CheckCircle2 size={18} />
          Konfirmasi Pembayaran · {formatRp(due)}
        </button>
      </div>
    </div>
  );
}

function NotaSuccess({ bill, onBack, onToast }: { bill: BillDetail; onBack: () => void; onToast: (k: 'info' | 'success', m: string) => void }) {
  return (
    <div className="card overflow-hidden" style={{ padding: 0 }}>
      <div className="text-center p-7 pb-4" style={{ background: 'var(--green-tint)' }}>
        <div
          className="w-14 h-14 rounded-full grid place-items-center mx-auto mb-2.5 text-white"
          style={{ background: 'var(--green)' }}
        >
          <Check size={30} />
        </div>
        <h2 className="h2">Pembayaran Berhasil</h2>
        <div className="muted text-[13px] mt-0.5">
          via {bill.payMethod?.toUpperCase()}
          {bill.payMethod === 'bpjs' && ' (ditanggung penuh)'}
        </div>
      </div>
      <div className="px-5 py-4" style={{ borderTop: '1px dashed var(--line)', borderBottom: '1px dashed var(--line)' }}>
        <Row k="No. Nota" v={`INV/2026/${bill.id.slice(-6).toUpperCase()}`} mono />
        <Row k="Pasien" v={bill.patient.name} />
        <Row k="Dibayar" v={bill.payMethod === 'bpjs' ? formatRp(0) : formatRp(bill.total)} bold mono />
      </div>
      <div className="card-pad flex gap-2.5 flex-wrap">
        <button className="btn btn-ghost flex-1" onClick={() => window.open(`/cetak/nota/${bill.id}`, '_blank')}>
          <Printer size={16} /> Cetak
        </button>
        <button className="btn btn-soft flex-1" onClick={() => onToast('success', `Nota dikirim via WhatsApp ke ${bill.patient.phone ?? '—'}`)}>
          <MessageCircle size={16} /> Kirim WA
        </button>
        <button className="btn btn-primary btn-block" onClick={onBack}>Selesai</button>
      </div>
    </div>
  );
}

function Row({ k, v, mono, bold }: { k: string; v: string; mono?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between text-[12.5px] mb-1">
      <span className="muted">{k}</span>
      <span className={`${mono ? 'mono' : ''} ${bold ? 'font-bold' : ''}`}>{v}</span>
    </div>
  );
}
