import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { IntegrationNotConfigured } from '@/lib/integrations/satusehat/client';

export function whatsappConfigured(): boolean {
  return Boolean(env.WA_PROVIDER_TOKEN);
}

/** Normalisasi nomor Indonesia ke format E.164 tanpa '+': 08xx → 628xx */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) return '62' + digits.slice(1);
  if (digits.startsWith('62')) return digits;
  return digits;
}

export interface WhatsAppMessage {
  to: string;
  body: string;
}

/**
 * Kirim pesan WhatsApp via provider (WhatsApp Business API / generic gateway).
 * Throw IntegrationNotConfigured bila token kosong → worker akan menunda.
 */
export async function sendWhatsApp(msg: WhatsAppMessage): Promise<{ providerId?: string }> {
  if (!whatsappConfigured()) throw new IntegrationNotConfigured('WhatsApp');
  const to = normalizePhone(msg.to);
  if (!to) throw new Error('Nomor tujuan kosong');

  const endpoint = env.WA_PROVIDER_URL || 'https://graph.facebook.com/v21.0/messages';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.WA_PROVIDER_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: msg.body },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`WhatsApp gagal: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = (await res.json().catch(() => ({}))) as { messages?: { id?: string }[] };
  logger.info({ to }, 'WhatsApp terkirim');
  return { providerId: data.messages?.[0]?.id };
}
