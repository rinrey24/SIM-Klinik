import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatRp = (n: number | string | null | undefined) =>
  'Rp' + Number(n ?? 0).toLocaleString('id-ID');

export const initials = (name: string) =>
  (name || '?').split(' ').filter((w) => !w.match(/^(dr\.|Ns\.|Apt\.)$/i))
    .slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export function formatTanggal(d: Date | string | null | undefined) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

export function formatJam(d: Date | string | null | undefined) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' })
    .format(date).replace(':', '.');
}
