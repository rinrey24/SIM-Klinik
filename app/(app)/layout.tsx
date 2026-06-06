import { requireAuth } from '@/lib/auth/session';
import { AppShell } from '@/components/shell/shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireAuth();
  return (
    <AppShell role={s.role} userName={s.name}>
      {children}
    </AppShell>
  );
}
