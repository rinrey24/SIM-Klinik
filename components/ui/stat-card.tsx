'use client';
import * as React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

export function StatCard({
  icon, label, value, trend, accent = 'var(--teal-600)', tint = 'var(--teal-tint)', foot,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  trend?: number;
  accent?: string;
  tint?: string;
  foot?: string;
}) {
  return (
    <div className="card card-pad fade-in flex flex-col gap-2.5 min-w-0">
      <div className="flex items-center justify-between">
        <div
          className="w-[38px] h-[38px] rounded-[11px] grid place-items-center"
          style={{ background: tint, color: accent }}
        >
          {icon}
        </div>
        {trend != null && (
          <span className={`badge ${trend >= 0 ? 'b-green' : 'b-red'}`} style={{ fontSize: 11 }}>
            {trend >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <div className="mono leading-tight" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>
          {value}
        </div>
        <div className="muted mt-0.5" style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
      </div>
      {foot && <div className="muted" style={{ fontSize: 12 }}>{foot}</div>}
    </div>
  );
}
