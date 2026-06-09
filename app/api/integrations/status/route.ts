import { apiAuth } from '@/lib/auth/rbac';
import { ok } from '@/lib/api';
import { satusehatConfigured } from '@/lib/integrations/satusehat/client';
import { bpjsConfigured } from '@/lib/integrations/bpjs/signature';
import { whatsappConfigured } from '@/lib/integrations/whatsapp/client';

export async function GET() {
  const auth = await apiAuth();
  if ('error' in auth) return auth.error;
  return ok({
    data: {
      satusehat: satusehatConfigured(),
      bpjs: bpjsConfigured(),
      whatsapp: whatsappConfigured(),
    },
  });
}
