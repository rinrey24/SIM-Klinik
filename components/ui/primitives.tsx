'use client';
import * as React from 'react';
import { cn, initials } from '@/lib/utils';
import { CheckCircle2, RotateCw, AlertTriangle, Shield, Check, Info, X, type LucideIcon } from 'lucide-react';

export type IconType = LucideIcon;

export function Avatar({ name, size = 40, color }: { name: string; size?: number; color?: string }) {
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.36, background: color ? color + '22' : undefined, color }}
    >
      {initials(name)}
    </div>
  );
}

export function PenjaminBadge({ jenis, sm }: { jenis: 'BPJS' | 'Umum' | 'Asuransi'; sm?: boolean }) {
  const map = { BPJS: 'b-teal', Umum: 'b-gray', Asuransi: 'b-sky' } as const;
  return (
    <span className={cn('badge', map[jenis])} style={sm ? { fontSize: 11, padding: '2px 7px' } : undefined}>
      {jenis}
    </span>
  );
}

export function SatuSehatBadge({ status }: { status: 'tersinkron' | 'menunggu' | 'gagal' }) {
  const m = {
    tersinkron: { cls: 'b-green', Icon: CheckCircle2, txt: 'Tersinkron SATUSEHAT' },
    menunggu:   { cls: 'b-amber', Icon: RotateCw, txt: 'Menunggu sinkron SATUSEHAT' },
    gagal:      { cls: 'b-red', Icon: AlertTriangle, txt: 'Gagal sinkron' },
  }[status] ?? { cls: 'b-gray', Icon: Shield, txt: 'SATUSEHAT' };
  const Icon = m.Icon;
  return (
    <span className={cn('badge', m.cls)} title={m.txt}>
      <Icon size={13} /> {m.txt}
    </span>
  );
}

const QSTATUS = {
  menunggu:  { cls: 'b-amber', dot: 'dot-amber', label: 'Menunggu' },
  dipanggil: { cls: 'b-sky', dot: 'dot-teal', label: 'Dipanggil' },
  dilayani:  { cls: 'b-violet', dot: 'dot-teal', label: 'Dilayani' },
  selesai:   { cls: 'b-green', dot: 'dot-green', label: 'Selesai' },
  batal:     { cls: 'b-gray', dot: 'dot-gray', label: 'Batal' },
} as const;

export function QueueBadge({ status }: { status: keyof typeof QSTATUS }) {
  const s = QSTATUS[status] ?? QSTATUS.menunggu;
  return (
    <span className={cn('badge', s.cls)}>
      <span className={cn('dot', s.dot, status === 'dipanggil' && 'pulse')} />
      {s.label}
    </span>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="h2">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({
  icon: Icon, title, sub, action,
}: { icon: LucideIcon; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="text-center px-5 py-9 flex flex-col items-center gap-2">
      <div
        className="w-14 h-14 rounded-2xl grid place-items-center mb-1"
        style={{ background: 'var(--surface-2)', color: 'var(--ink-4)' }}
      >
        <Icon size={26} />
      </div>
      <div className="h3">{title}</div>
      {sub && <div className="muted text-[13px] max-w-[280px]">{sub}</div>}
      {action}
    </div>
  );
}

export function Modal({
  title, onClose, children, footer, wide,
}: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0" style={{ background: 'rgba(10,20,19,.45)', backdropFilter: 'blur(2px)' }} />
      <div
        className="card fade-in relative flex flex-col"
        style={{
          width: wide ? 'min(640px, 94%)' : 'min(480px, 94%)',
          maxHeight: '92%', borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
          <h3 className="h2">{title}</h3>
          <button className="btn btn-icon btn-ghost" style={{ width: 36, height: 36, minHeight: 0 }} onClick={onClose} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-5 py-3.5 border-t flex gap-2.5 justify-end" style={{ borderColor: 'var(--line)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Toast({ kind, children }: { kind: 'info' | 'success'; children: React.ReactNode }) {
  const Icon = kind === 'info' ? Info : Check;
  return (
    <div className="card flex items-center gap-2.5 px-4 py-2.5" style={{ boxShadow: 'var(--shadow-lg)' }}>
      <div
        className="w-[22px] h-[22px] rounded-full grid place-items-center flex-none"
        style={{
          background: kind === 'info' ? 'var(--sky-bg)' : 'var(--green-bg)',
          color: kind === 'info' ? 'var(--sky)' : 'var(--green)',
        }}
      >
        <Icon size={14} />
      </div>
      <span className="text-[13px] font-semibold">{children}</span>
    </div>
  );
}
