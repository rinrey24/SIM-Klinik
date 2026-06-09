'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, UserPlus, ListChecks, Calendar, Stethoscope, Pill,
  Receipt, BarChart3, Settings, Heart, Bell, Search, LogOut, Menu, X, Sun, Moon, FileText,
  type LucideIcon,
} from 'lucide-react';
import { Avatar, SatuSehatBadge } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

type Role = 'admin' | 'pendaftaran' | 'dokter' | 'perawat' | 'apoteker' | 'kasir';

const META: Record<string, { title: string; Icon: LucideIcon; path: string }> = {
  dashboard:   { title: 'Dashboard', Icon: LayoutDashboard, path: '/dashboard' },
  pendaftaran: { title: 'Pendaftaran', Icon: UserPlus, path: '/pendaftaran' },
  antrian:     { title: 'Antrian', Icon: ListChecks, path: '/antrian' },
  jadwal:      { title: 'Jadwal', Icon: Calendar, path: '/jadwal' },
  rme:         { title: 'Rekam Medis', Icon: Stethoscope, path: '/rme' },
  surat:       { title: 'Surat', Icon: FileText, path: '/surat' },
  farmasi:     { title: 'Farmasi', Icon: Pill, path: '/farmasi' },
  kasir:       { title: 'Kasir', Icon: Receipt, path: '/kasir' },
  laporan:     { title: 'Laporan', Icon: BarChart3, path: '/laporan' },
  pengaturan:  { title: 'Pengaturan', Icon: Settings, path: '/pengaturan' },
};

const NAV: Record<Role, string[]> = {
  admin:       ['dashboard', 'antrian', 'jadwal', 'laporan', 'farmasi', 'pengaturan'],
  pendaftaran: ['pendaftaran', 'antrian', 'jadwal'],
  dokter:      ['antrian', 'rme', 'surat', 'jadwal'],
  perawat:     ['antrian', 'pendaftaran'],
  apoteker:    ['farmasi'],
  kasir:       ['kasir', 'antrian'],
};

const ROLE_META: Record<Role, { short: string; color: string }> = {
  admin:       { short: 'Admin', color: 'var(--violet)' },
  pendaftaran: { short: 'Pendaftaran', color: 'var(--sky)' },
  dokter:      { short: 'Dokter', color: 'var(--teal-600)' },
  perawat:     { short: 'Perawat', color: 'var(--green)' },
  apoteker:    { short: 'Apoteker', color: 'var(--amber)' },
  kasir:       { short: 'Kasir', color: 'var(--red)' },
};

export function AppShell({
  children, role, userName,
}: { children: React.ReactNode; role: Role; userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = NAV[role];
  const main = nav.slice(0, 4);
  const overflow = nav.slice(4);
  const [more, setMore] = React.useState(false);
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');
  const current = nav.find((k) => pathname?.startsWith(META[k].path)) ?? nav[0];

  React.useEffect(() => {
    const saved = (localStorage.getItem('sk_theme') as 'light' | 'dark' | null);
    if (saved) setTheme(saved);
  }, []);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sk_theme', theme);
  }, [theme]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex" data-theme={theme}>
      {/* Sidebar (desktop) */}
      <aside
        className="hidden md:flex flex-col w-[240px] border-r flex-none"
        style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
      >
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-2.5">
          <div
            className="w-[34px] h-[34px] rounded-[10px] grid place-items-center flex-none"
            style={{ background: 'var(--teal-600)', color: '#fff' }}
          >
            <Heart size={19} />
          </div>
          <div className="leading-tight min-w-0">
            <div className="font-extrabold text-sm truncate">Sehat Bersama</div>
            <div className="muted text-[11px]">SIM Klinik</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-1.5">
          <div className="eyebrow px-2 py-2">Menu</div>
          {nav.map((k) => {
            const m = META[k];
            const active = current === k;
            return (
              <Link
                key={k}
                href={m.path}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] mb-0.5 text-sm font-semibold transition-colors',
                  active && 'text-[var(--teal-700)] dark:text-[var(--teal-300)]',
                )}
                style={{
                  background: active ? 'var(--teal-tint)' : 'transparent',
                  color: active ? 'var(--teal-700)' : 'var(--ink-2)',
                }}
              >
                <m.Icon size={19} />
                {m.title}
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: 'var(--teal-500)' }} />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2.5 p-3 border-t" style={{ borderColor: 'var(--line)' }}>
          <Avatar name={userName} size={36} color={ROLE_META[role].color} />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[13px] truncate">{userName}</div>
            <div className="muted text-[11px]">{ROLE_META[role].short}</div>
          </div>
          <button
            onClick={logout}
            className="btn btn-icon btn-ghost"
            style={{ width: 34, height: 34, minHeight: 0, border: 'none', background: 'transparent', color: 'var(--ink-3)' }}
            title="Keluar"
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--bg)' }}>
        {/* Mobile header */}
        <div
          className="md:hidden flex items-center gap-2.5 px-4 py-2.5 border-b"
          style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
        >
          <div
            className="w-[30px] h-[30px] rounded-[9px] grid place-items-center flex-none"
            style={{ background: 'var(--teal-600)', color: '#fff' }}
          >
            {React.createElement(META[current].Icon, { size: 17 })}
          </div>
          <strong className="text-base flex-1">{META[current].title}</strong>
          <button
            className="btn btn-icon btn-ghost relative"
            style={{ width: 38, height: 38, minHeight: 0 }}
            aria-label="Notifikasi"
          >
            <Bell size={18} />
            <span className="absolute top-[7px] right-2 w-[7px] h-[7px] rounded-full" style={{ background: 'var(--red)' }} />
          </button>
          <button
            onClick={logout}
            className="btn btn-icon btn-ghost"
            style={{ width: 38, height: 38, minHeight: 0 }}
            title="Keluar"
          >
            <LogOut size={18} />
          </button>
        </div>

        {/* Desktop top bar */}
        <div
          className="hidden md:flex items-center gap-3.5 px-6 border-b flex-none"
          style={{ height: 62, background: 'var(--surface)', borderColor: 'var(--line)' }}
        >
          <div className="input-icon max-w-[360px] flex-1">
            <Search size={17} />
            <input
              className="input"
              style={{ minHeight: 40, background: 'var(--surface-2)', border: 'none' }}
              placeholder="Cari pasien, no. RM, obat…"
            />
          </div>
          <div className="flex-1" />
          <SatuSehatBadge status="tersinkron" />
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="btn btn-icon btn-ghost"
            style={{ width: 40, height: 40, minHeight: 0 }}
            title="Ganti tema"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="btn btn-icon btn-ghost relative"
            style={{ width: 40, height: 40, minHeight: 0 }}
            aria-label="Notifikasi"
          >
            <Bell size={19} />
            <span className="absolute top-2 right-[9px] w-[7px] h-[7px] rounded-full" style={{ background: 'var(--red)' }} />
          </button>
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">{children}</main>

        {/* Mobile bottom nav */}
        <div
          className="md:hidden fixed bottom-0 left-0 right-0 flex items-stretch border-t z-30"
          style={{ height: 72, background: 'var(--surface)', borderColor: 'var(--line)', paddingBottom: 10 }}
        >
          {main.map((k) => {
            const m = META[k];
            const active = current === k;
            return (
              <Link
                key={k}
                href={m.path}
                className="flex-1 flex flex-col items-center justify-center gap-0.5"
                style={{ color: active ? 'var(--teal-600)' : 'var(--ink-4)' }}
              >
                <m.Icon size={22} />
                <span className="text-[10.5px]" style={{ fontWeight: active ? 700 : 600 }}>{m.title}</span>
              </Link>
            );
          })}
          {overflow.length > 0 && (
            <button
              onClick={() => setMore(true)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5"
              style={{ color: overflow.includes(current) ? 'var(--teal-600)' : 'var(--ink-4)' }}
            >
              <Menu size={22} />
              <span className="text-[10.5px] font-semibold">Lainnya</span>
            </button>
          )}
        </div>
      </div>

      {more && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end md:hidden">
          <div onClick={() => setMore(false)} className="absolute inset-0" style={{ background: 'rgba(10,20,19,.4)' }} />
          <div className="card fade-in relative p-4 pb-6" style={{ borderRadius: '20px 20px 0 0' }}>
            <div className="w-10 h-1 rounded mx-auto mb-3.5" style={{ background: 'var(--line)' }} />
            <div className="grid grid-cols-2 gap-2.5">
              {overflow.map((k) => {
                const m = META[k];
                return (
                  <Link
                    key={k}
                    href={m.path}
                    onClick={() => setMore(false)}
                    className="card p-4 flex flex-col gap-2 items-start"
                    style={{
                      border: current === k ? '1.5px solid var(--teal-500)' : '1px solid var(--line)',
                      background: 'var(--surface)',
                    }}
                  >
                    <div
                      className="w-[38px] h-[38px] rounded-[10px] grid place-items-center"
                      style={{ background: 'var(--teal-tint)', color: 'var(--teal-600)' }}
                    >
                      <m.Icon size={20} />
                    </div>
                    <strong className="text-sm">{m.title}</strong>
                  </Link>
                );
              })}
            </div>
            <button className="btn btn-ghost btn-block mt-4" onClick={() => setMore(false)}>
              <X size={16} /> Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
