import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { ROLE_HOMES } from '@/lib/auth/rbac';

export default async function Index() {
  const s = await getSession();
  if (!s) redirect('/login');
  redirect(ROLE_HOMES[s.role]);
}
