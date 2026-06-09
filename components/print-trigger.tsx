'use client';
import { Printer, X } from 'lucide-react';

export function PrintBar({ title }: { title?: string }) {
  return (
    <div
      className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 mb-4"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}
    >
      <strong className="text-[14px]">{title ?? 'Pratinjau Cetak'}</strong>
      <div className="flex items-center gap-2">
        <button className="btn btn-ghost btn-sm" onClick={() => window.close()}>
          <X size={15} /> Tutup
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
          <Printer size={15} /> Cetak
        </button>
      </div>
    </div>
  );
}
