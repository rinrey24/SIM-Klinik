import { pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['admin', 'pendaftaran', 'dokter', 'perawat', 'apoteker', 'kasir']);
export const penjaminEnum = pgEnum('penjamin', ['BPJS', 'Umum', 'Asuransi']);
export const sexEnum = pgEnum('sex', ['L', 'P']);
export const queueStatusEnum = pgEnum('queue_status', ['menunggu', 'dipanggil', 'dilayani', 'selesai', 'batal']);
export const queueSourceEnum = pgEnum('queue_source', ['walk_in', 'online']);
export const rxStatusEnum = pgEnum('rx_status', ['masuk', 'disiapkan', 'diserahkan', 'batal']);
export const billStatusEnum = pgEnum('bill_status', ['belum', 'lunas', 'batal']);
export const billItemTypeEnum = pgEnum('bill_item_type', ['jasa', 'tindakan', 'obat']);
export const payMethodEnum = pgEnum('pay_method', ['tunai', 'qris', 'kartu', 'bpjs']);
export const syncStatusEnum = pgEnum('sync_status', ['menunggu', 'tersinkron', 'gagal']);
export const tariffTypeEnum = pgEnum('tariff_type', ['jasa', 'tindakan']);
export const appointmentStatusEnum = pgEnum('appointment_status', ['terjadwal', 'selesai', 'batal']);
export const outboxKindEnum = pgEnum('outbox_kind', ['satusehat', 'whatsapp', 'bpjs', 'email']);
export const outboxStatusEnum = pgEnum('outbox_status', ['menunggu', 'sukses', 'gagal']);
