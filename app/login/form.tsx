'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Shield, Stethoscope, Activity, User, Lock, Eye, EyeOff, ArrowRight, AlertTriangle, Check } from 'lucide-react';

type Role = 'admin' | 'pendaftaran' | 'dokter' | 'perawat' | 'apoteker' | 'kasir';

const ROLES: { key: Role; short: string; color: string }[] = [
  { key: 'admin', short: 'Admin', color: 'var(--violet)' },
  { key: 'pendaftaran', short: 'Pendaftaran', color: 'var(--sky)' },
  { key: 'dokter', short: 'Dokter', color: 'var(--teal-600)' },
  { key: 'perawat', short: 'Perawat', color: 'var(--green)' },
  { key: 'apoteker', short: 'Apoteker', color: 'var(--amber)' },
  { key: 'kasir', short: 'Kasir', color: 'var(--red)' },
];

const EMAILS: Record<Role, string> = {
  admin: 'admin@kliniksehatbersama.id',
  pendaftaran: 'pendaftaran@kliniksehatbersama.id',
  dokter: 'dr.andini@kliniksehatbersama.id',
  perawat: 'perawat.dewi@kliniksehatbersama.id',
  apoteker: 'apt.rangga@kliniksehatbersama.id',
  kasir: 'kasir@kliniksehatbersama.id',
};

export function LoginForm() {
  const router = useRouter();
  const [role, setRole] = React.useState<Role>('admin');
  const [email, setEmail] = React.useState(EMAILS.admin);
  const [pw, setPw] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [remember, setRemember] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const pickRole = (k: Role) => { setRole(k); setEmail(EMAILS[k]); setErr(''); };

  const submit = async () => {
    if (!email.trim() || !pw.trim()) { setErr('Email dan kata sandi wajib diisi.'); return; }
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pw }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data?.error?.message ?? 'Gagal masuk.'); setBusy(false); return; }
      router.refresh();
      router.push('/');
    } catch {
      setErr('Terjadi gangguan jaringan.'); setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-4" style={{ background: 'var(--bg)' }}>
      <div
        className="card fade-in w-full max-w-[880px] grid md:grid-cols-[1fr_1.1fr] overflow-hidden"
        style={{ borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow-lg)', minHeight: 520 }}
      >
        {/* Brand panel */}
        <div
          className="relative flex flex-col justify-between p-9 text-white overflow-hidden"
          style={{ background: 'linear-gradient(150deg, var(--teal-700), var(--teal-600) 60%, var(--teal-500))' }}
        >
          <div
            className="absolute rounded-full"
            style={{ width: 260, height: 260, background: 'rgba(255,255,255,.08)', top: -90, right: -70 }}
          />
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-7">
              <div className="w-[42px] h-[42px] rounded-xl grid place-items-center" style={{ background: 'rgba(255,255,255,.16)' }}>
                <Heart size={24} />
              </div>
              <div className="leading-tight">
                <div className="font-extrabold text-[17px]">Sehat Bersama</div>
                <div className="text-[11.5px] opacity-80">SIM Klinik</div>
              </div>
            </div>
            <h1 className="font-extrabold text-[27px] leading-tight max-w-[320px] mb-2.5" style={{ letterSpacing: '-.02em' }}>
              Satu sistem untuk seluruh alur klinik Anda.
            </h1>
            <p className="text-sm opacity-85 max-w-[300px] leading-relaxed">
              Pendaftaran, antrian, rekam medis, apotek, hingga kasir — terhubung dan real-time.
            </p>
          </div>
          <div className="relative flex flex-col gap-3 mt-6">
            {([
              [Shield, 'Terhubung SATUSEHAT & BPJS'],
              [Stethoscope, 'Rekam medis elektronik terpadu'],
              [Activity, 'Antrian & kasir real-time'],
            ] as const).map(([Icon, txt]) => (
              <div key={txt} className="flex items-center gap-2.5 text-[13px] font-semibold">
                <span className="w-[26px] h-[26px] rounded-lg grid place-items-center flex-none" style={{ background: 'rgba(255,255,255,.16)' }}>
                  <Icon size={15} />
                </span>
                {txt}
              </div>
            ))}
          </div>
        </div>

        {/* Form panel */}
        <div className="p-8 md:p-11 flex flex-col justify-center" style={{ background: 'var(--surface)' }}>
          <div className="mb-5">
            <h2 className="h1">Masuk ke akun Anda</h2>
            <div className="muted mt-1 text-[13.5px]">Selamat datang kembali. Silakan masuk untuk melanjutkan.</div>
          </div>

          <div className="flex flex-col gap-3.5">
            <div>
              <div className="label flex items-center gap-1.5 mb-1.5">
                Masuk sebagai <span className="badge b-gray" style={{ fontSize: 10 }}>demo</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ROLES.map((r) => {
                  const on = role === r.key;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => pickRole(r.key)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-bold text-[12.5px] cursor-pointer transition-colors"
                      style={{
                        border: `1.5px solid ${on ? 'var(--teal-500)' : 'var(--line)'}`,
                        background: on ? 'var(--teal-tint)' : 'var(--surface)',
                        color: on ? 'var(--teal-700)' : 'var(--ink-3)',
                      }}
                    >
                      <span className="dot" style={{ background: r.color }} />
                      {r.short}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="field">
              <label className="label">Email</label>
              <div className="input-icon">
                <User size={17} />
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@klinik.id" />
              </div>
            </div>

            <div className="field">
              <label className="label">Kata sandi</label>
              <div className="input-icon relative">
                <Lock size={17} />
                <input
                  className="input"
                  type={show ? 'text' : 'password'}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  placeholder="••••••••"
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="btn btn-icon btn-ghost"
                  style={{
                    position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)',
                    width: 34, height: 34, minHeight: 0, border: 'none', background: 'transparent', color: 'var(--ink-4)',
                  }}
                  aria-label={show ? 'Sembunyikan' : 'Tampilkan'}
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {err && (
              <div className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: 'var(--red)' }}>
                <AlertTriangle size={15} /> {err}
              </div>
            )}

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                <span
                  onClick={() => setRemember(!remember)}
                  className="w-5 h-5 rounded-md grid place-items-center text-white flex-none"
                  style={{
                    border: `1.5px solid ${remember ? 'var(--teal-500)' : 'var(--line)'}`,
                    background: remember ? 'var(--teal-500)' : 'var(--surface)',
                  }}
                >
                  {remember && <Check size={14} />}
                </span>
                Ingat saya
              </label>
              <a href="#" className="text-[13px] font-bold no-underline" style={{ color: 'var(--teal-600)' }}>Lupa kata sandi?</a>
            </div>

            <button
              className="btn btn-primary btn-block mt-0.5"
              style={{ fontSize: 15, padding: 13 }}
              onClick={submit}
              disabled={busy}
            >
              {busy ? 'Memverifikasi…' : <>Masuk <ArrowRight size={18} /></>}
            </button>
          </div>

          <div className="muted text-[12.5px] text-center mt-5">
            Belum punya akses? Hubungi admin klinik Anda.
          </div>
        </div>
      </div>
    </div>
  );
}
