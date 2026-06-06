import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const font = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-plus-jakarta', display: 'swap' });

export const metadata: Metadata = {
  title: 'SIM Klinik — Sehat Bersama',
  description: 'Sistem Informasi Manajemen Klinik — Pendaftaran, RME, Apotek, Kasir.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={font.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
