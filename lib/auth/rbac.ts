import { NextResponse } from 'next/server';
import { getSession } from './session';
import type { AccessClaims } from './jwt';

type Role = AccessClaims['role'];

export async function apiAuth(roles?: Role[]) {
  const s = await getSession();
  if (!s) return { error: NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Silakan login terlebih dahulu.' } }, { status: 401 }) } as const;
  if (roles && !roles.includes(s.role)) {
    return { error: NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Peran Anda tidak diizinkan untuk aksi ini.' } }, { status: 403 }) } as const;
  }
  return { session: s } as const;
}

export const ROLE_HOMES: Record<Role, string> = {
  admin: '/dashboard',
  pendaftaran: '/pendaftaran',
  dokter: '/antrian',
  perawat: '/antrian',
  apoteker: '/farmasi',
  kasir: '/kasir',
};

export const ROLE_NAV: Record<Role, string[]> = {
  admin: ['dashboard', 'antrian', 'jadwal', 'laporan', 'farmasi', 'pengaturan'],
  pendaftaran: ['pendaftaran', 'antrian', 'jadwal'],
  dokter: ['antrian', 'rme', 'surat', 'jadwal'],
  perawat: ['antrian', 'pendaftaran'],
  apoteker: ['farmasi'],
  kasir: ['kasir', 'antrian'],
};

export const ROLE_META: Record<Role, { label: string; short: string; color: string }> = {
  admin:       { label: 'Admin / Manajemen', short: 'Admin', color: 'var(--violet)' },
  pendaftaran: { label: 'Petugas Pendaftaran', short: 'Pendaftaran', color: 'var(--sky)' },
  dokter:      { label: 'Dokter Umum', short: 'Dokter', color: 'var(--teal-600)' },
  perawat:     { label: 'Perawat', short: 'Perawat', color: 'var(--green)' },
  apoteker:    { label: 'Apoteker', short: 'Apoteker', color: 'var(--amber)' },
  kasir:       { label: 'Kasir', short: 'Kasir', color: 'var(--red)' },
};
