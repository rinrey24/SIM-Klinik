import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { ROLE_HOMES } from '@/lib/auth/rbac';
import { LoginForm } from './form';

export default async function LoginPage() {
  const s = await getSession();
  if (s) redirect(ROLE_HOMES[s.role]);
  return <LoginForm />;
}
