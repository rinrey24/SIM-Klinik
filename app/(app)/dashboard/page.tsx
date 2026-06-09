import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { drugs, encounters, patients } from '@/drizzle/schema';
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { Users, ListChecks, Wallet, AlertTriangle } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { DashboardClient } from './client';
import { formatRp } from '@/lib/utils';

export default async function DashboardPage() {
  const s = await requireRole(['admin']);
  const branchId = s.branchId;

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);

  // Jalankan paralel — keempat agregat independen
  const [pasienRows, antrianRows, lowStock, patientRows] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` })
      .from(encounters)
      .where(and(eq(encounters.branchId, branchId), gte(encounters.arrivedAt, todayStart), lt(encounters.arrivedAt, todayEnd))),
    db.select({ n: sql<number>`count(*)::int` })
      .from(encounters)
      .where(and(eq(encounters.branchId, branchId), sql`status <> 'selesai' and status <> 'batal'`)),
    db.select({ id: drugs.id, name: drugs.name, kind: drugs.kind, stock: drugs.stock, min: drugs.minStock })
      .from(drugs)
      .where(and(eq(drugs.branchId, branchId), sql`stock < min_stock`)),
    db.select({ total: sql<number>`count(*)::int` })
      .from(patients)
      .where(eq(patients.branchId, branchId)),
  ]);
  const pasienHariIniRow = pasienRows[0];
  const antrianAktifRow = antrianRows[0];
  const totalPasien = patientRows[0].total;

  const greeting = new Date().getHours() < 11 ? 'Selamat pagi'
    : new Date().getHours() < 15 ? 'Selamat siang' : 'Selamat sore';
  const firstName = s.name.split(' ').filter((w) => !/^(dr\.|Ns\.|Apt\.)$/i.test(w))[0] ?? s.name;

  return (
    <div className="fade-in flex flex-col gap-4">
      <div>
        <div className="eyebrow">
          {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())}
        </div>
        <h1 className="h1 mt-1">{greeting}, {firstName}</h1>
        <div className="muted text-[13.5px] mt-0.5">
          Berikut ringkasan operasional Klinik Sehat Bersama hari ini.
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Users size={20} />} label="Pasien hari ini" value={pasienHariIniRow.n} foot={`${totalPasien} total terdaftar`} />
        <StatCard
          icon={<ListChecks size={20} />}
          label="Antrian aktif"
          value={antrianAktifRow.n}
          accent="var(--sky)"
          tint="var(--sky-bg)"
        />
        <StatCard
          icon={<Wallet size={20} />}
          label="Pendapatan hari ini"
          value={formatRp(0)}
          accent="var(--green)"
          tint="var(--green-bg)"
          foot="belum ada transaksi"
        />
        <StatCard
          icon={<AlertTriangle size={20} />}
          label="Stok obat menipis"
          value={lowStock.length}
          accent="var(--red)"
          tint="var(--red-bg)"
          foot={lowStock.length ? 'perlu restock' : 'aman'}
        />
      </div>

      <DashboardClient
        trend={{ data: [18, 22, 19, 27, 24, 31, pasienHariIniRow.n], labels: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] }}
        lowStock={lowStock}
      />
    </div>
  );
}
