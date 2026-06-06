'use client';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { SectionTitle, EmptyState } from '@/components/ui/primitives';

export function DashboardClient({
  trend, lowStock,
}: {
  trend: { data: number[]; labels: string[] };
  lowStock: { id: string; name: string; kind: string; stock: number; min: number }[];
}) {
  const max = Math.max(1, ...trend.data);
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-4">
      <div className="card card-pad">
        <SectionTitle action={<span className="badge b-teal">7 hari</span>}>Tren kunjungan</SectionTitle>
        <div className="flex items-end gap-2" style={{ height: 140, paddingTop: 8 }}>
          {trend.data.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 justify-end" style={{ height: '100%' }}>
              <div className="mono text-[11px] font-bold" style={{ color: 'var(--ink-3)' }}>{v}</div>
              <div
                style={{
                  width: '100%', maxWidth: 26,
                  height: `${(v / max) * 100}px`,
                  background: i === trend.data.length - 1 ? 'var(--teal-500)' : 'color-mix(in srgb, var(--teal-500) 35%, transparent)',
                  borderRadius: 6, transition: 'height .4s ease',
                }}
              />
              <div className="muted text-[11px] font-semibold">{trend.labels[i]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card card-pad">
        <SectionTitle action={<Link className="btn btn-sm btn-soft" href="/farmasi">Kelola stok</Link>}>
          Stok menipis
        </SectionTitle>
        {lowStock.length === 0 ? (
          <EmptyState icon={Check} title="Stok aman" sub="Tidak ada obat di bawah batas minimum." />
        ) : (
          <div className="flex flex-col gap-2">
            {lowStock.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-[10px]"
                style={{ background: 'var(--red-tint)' }}
              >
                <div>
                  <div className="font-bold text-[13.5px]">{d.name}</div>
                  <div className="muted text-[12px]">Min. {d.min} {d.kind.toLowerCase()}</div>
                </div>
                <span className="badge b-red mono">{d.stock} tersisa</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
