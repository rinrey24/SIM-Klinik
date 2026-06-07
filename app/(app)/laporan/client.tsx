'use client';
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wallet, Users, Receipt, Pill, Calendar, FileText } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { formatRp, formatTanggal } from '@/lib/utils';

type Summary = {
  range: { from: string; to: string };
  pendapatan: number;
  transaksi: number;
  rataTransaksi: number;
  kunjungan: number;
  resepDilayani: number;
  trend: { day: string; n: number }[];
  penjamin: { penjamin: 'BPJS' | 'Umum' | 'Asuransi'; n: number }[];
};

type TopDrug = { drugId: string; name: string; total: number };
type DoctorPerf = { doctorId: string; name: string; sip: string | null; pasien: number; pendapatan: number; rataDurasi: number };

export function LaporanClient() {
  const today = new Date();
  const lastWeek = new Date(); lastWeek.setDate(lastWeek.getDate() - 6);
  const [from, setFrom] = React.useState(lastWeek.toISOString().slice(0, 10));
  const [to, setTo] = React.useState(today.toISOString().slice(0, 10));

  const summary = useQuery({
    queryKey: ['report-summary', from, to],
    queryFn: async () => (await (await fetch(`/api/reports/summary?from=${from}&to=${to}`)).json()) as { data: Summary },
  });
  const topDrugs = useQuery({
    queryKey: ['report-drugs', from, to],
    queryFn: async () => (await (await fetch(`/api/reports/top-drugs?from=${from}&to=${to}`)).json()) as { data: TopDrug[] },
  });
  const doctors = useQuery({
    queryKey: ['report-doctors', from, to],
    queryFn: async () => (await (await fetch(`/api/reports/doctors?from=${from}&to=${to}`)).json()) as { data: DoctorPerf[] },
  });

  const s = summary.data?.data;
  const drugs = topDrugs.data?.data ?? [];
  const docs = doctors.data?.data ?? [];
  const maxDrug = Math.max(1, ...drugs.map((d) => d.total));
  const maxTrend = Math.max(1, ...(s?.trend.map((t) => t.n) ?? [0]));

  return (
    <div className="fade-in flex flex-col gap-3.5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="h1">Laporan</h1>
          <div className="muted text-[13.5px] mt-0.5">
            Periode {formatTanggal(from)} – {formatTanggal(to)}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="input-icon">
            <Calendar size={16} />
            <input type="date" className="input" style={{ paddingLeft: 36, minHeight: 36 }} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <span className="muted">–</span>
          <div className="input-icon">
            <Calendar size={16} />
            <input type="date" className="input" style={{ paddingLeft: 36, minHeight: 36 }} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <a
            className="btn btn-primary btn-sm"
            href={`/api/reports/export?type=bills&from=${from}&to=${to}`}
            download
          >
            <FileText size={15} /> Ekspor CSV
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Wallet size={20} />} label="Pendapatan" value={formatRp(s?.pendapatan ?? 0)} accent="var(--green)" tint="var(--green-bg)" />
        <StatCard icon={<Users size={20} />} label="Total kunjungan" value={s?.kunjungan ?? 0} />
        <StatCard icon={<Receipt size={20} />} label="Rata-rata transaksi" value={formatRp(s?.rataTransaksi ?? 0)} accent="var(--sky)" tint="var(--sky-bg)" />
        <StatCard icon={<Pill size={20} />} label="Resep dilayani" value={s?.resepDilayani ?? 0} accent="var(--amber)" tint="var(--amber-bg)" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-3.5">
        <div className="card card-pad">
          <h2 className="h2 mb-2">Tren kunjungan harian</h2>
          {summary.isLoading ? (
            <div className="skel h-32" />
          ) : (
            <div className="flex items-end gap-2" style={{ height: 140, paddingTop: 8 }}>
              {(s?.trend ?? []).map((t) => (
                <div key={t.day} className="flex-1 flex flex-col items-center gap-1.5 justify-end" style={{ height: '100%' }}>
                  <div className="mono text-[11px] font-bold" style={{ color: 'var(--ink-3)' }}>{t.n}</div>
                  <div
                    style={{
                      width: '100%', maxWidth: 26,
                      height: `${(t.n / maxTrend) * 100}px`,
                      background: 'var(--teal-500)', borderRadius: 6,
                    }}
                  />
                  <div className="muted text-[11px] font-semibold">{t.day.slice(8, 10)}/{t.day.slice(5, 7)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card card-pad">
          <h2 className="h2 mb-3">Obat terlaris</h2>
          {topDrugs.isLoading ? (
            <div className="skel h-32" />
          ) : drugs.length === 0 ? (
            <div className="muted text-[13px]">Belum ada data dispense pada periode ini.</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {drugs.map((d) => (
                <div key={d.drugId}>
                  <div className="flex justify-between text-[13px] mb-1">
                    <span>{d.name}</span>
                    <strong className="mono">{d.total}</strong>
                  </div>
                  <div style={{ height: 7, background: 'var(--line)', borderRadius: 6 }}>
                    <div
                      style={{
                        width: `${(d.total / maxDrug) * 100}%`,
                        height: '100%', background: 'var(--teal-500)', borderRadius: 6,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card card-pad">
        <h2 className="h2 mb-3">Performa dokter</h2>
        {doctors.isLoading ? (
          <div className="skel h-24" />
        ) : docs.length === 0 ? (
          <div className="muted text-[13px]">Belum ada kunjungan pada periode ini.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr><th>Dokter</th><th>SIP</th><th>Pasien</th><th>Rata durasi</th><th>Pendapatan</th></tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.doctorId}>
                    <td><strong>{d.name}</strong></td>
                    <td className="mono muted">{d.sip ?? '—'}</td>
                    <td className="mono">{d.pasien}</td>
                    <td className="mono muted">{d.rataDurasi} mnt</td>
                    <td className="mono">{formatRp(d.pendapatan)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
