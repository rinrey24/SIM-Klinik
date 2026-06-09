import {
  pgTable, uuid, text, varchar, integer, boolean, timestamp, date, numeric,
  jsonb, uniqueIndex, index, customType,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import {
  roleEnum, penjaminEnum, sexEnum, queueStatusEnum, queueSourceEnum, rxStatusEnum,
  billStatusEnum, billItemTypeEnum, payMethodEnum, syncStatusEnum, tariffTypeEnum,
  appointmentStatusEnum, outboxKindEnum, outboxStatusEnum, documentTypeEnum,
} from './enums';

export * from './enums';

const bytea = customType<{ data: Buffer; default: false }>({
  dataType() { return 'bytea'; },
});

const ts = () => timestamp({ withTimezone: true }).defaultNow().notNull();

export const branches = pgTable('branches', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  address: text(),
  phone: text(),
  logoUrl: text(),
  accentColor: varchar({ length: 16 }).default('#0d9488'),
  satusehatOrgId: text(),
  createdAt: ts(),
});

export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  branchId: uuid().notNull().references(() => branches.id),
  name: text().notNull(),
  email: text().notNull(),
  passwordHash: text().notNull(),
  role: roleEnum().notNull(),
  sip: text(),
  satusehatPractitionerId: text(),
  bpjsDokterKode: text(),
  active: boolean().default(true).notNull(),
  createdAt: ts(),
}, (t) => [
  uniqueIndex('users_email_uniq').on(t.email),
  index('users_branch_role_idx').on(t.branchId, t.role),
]);

export const sessions = pgTable('sessions', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  refreshTokenHash: text().notNull(),
  userAgent: text(),
  ip: text(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  revokedAt: timestamp({ withTimezone: true }),
  createdAt: ts(),
}, (t) => [index('sessions_user_idx').on(t.userId)]);

export const patients = pgTable('patients', {
  id: uuid().primaryKey().defaultRandom(),
  branchId: uuid().notNull().references(() => branches.id),
  rmNumber: text().notNull(),
  nik: varchar({ length: 16 }),
  name: text().notNull(),
  sex: sexEnum().notNull(),
  dob: date(),
  phone: text(),
  address: text(),
  penjamin: penjaminEnum().notNull().default('Umum'),
  bpjsNumber: text(),
  satusehatIhsId: text(),
  allergies: text(),
  createdAt: ts(),
}, (t) => [
  uniqueIndex('patients_branch_rm_uniq').on(t.branchId, t.rmNumber),
  index('patients_nik_idx').on(t.nik),
  index('patients_name_idx').on(t.name),
  index('patients_phone_idx').on(t.phone),
]);

export const encounters = pgTable('encounters', {
  id: uuid().primaryKey().defaultRandom(),
  branchId: uuid().notNull().references(() => branches.id),
  queueNo: text().notNull(),
  patientId: uuid().notNull().references(() => patients.id),
  doctorId: uuid().notNull().references(() => users.id),
  status: queueStatusEnum().notNull().default('menunggu'),
  source: queueSourceEnum().notNull().default('walk_in'),
  complaint: text(),
  arrivedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp({ withTimezone: true }),
  finishedAt: timestamp({ withTimezone: true }),
  satusehatEncounterId: text(),
  syncStatus: syncStatusEnum().notNull().default('menunggu'),
  createdAt: ts(),
}, (t) => [
  index('encounters_branch_status_idx').on(t.branchId, t.status),
  index('encounters_patient_idx').on(t.patientId),
  index('encounters_doctor_idx').on(t.doctorId),
]);

export const vitalSigns = pgTable('vital_signs', {
  id: uuid().primaryKey().defaultRandom(),
  encounterId: uuid().notNull().references(() => encounters.id, { onDelete: 'cascade' }),
  td: text(),
  nadi: integer(),
  suhu: numeric({ precision: 4, scale: 1 }),
  rr: integer(),
  spo2: integer(),
  bb: numeric({ precision: 5, scale: 1 }),
  tb: numeric({ precision: 5, scale: 1 }),
  recordedBy: uuid().references(() => users.id),
  recordedAt: ts(),
});

export const medicalRecords = pgTable('medical_records', {
  id: uuid().primaryKey().defaultRandom(),
  encounterId: uuid().notNull().references(() => encounters.id, { onDelete: 'cascade' }),
  patientId: uuid().notNull().references(() => patients.id),
  doctorId: uuid().notNull().references(() => users.id),
  s: text(),
  o: text(),
  a: text(),
  p: text(),
  syncStatus: syncStatusEnum().notNull().default('menunggu'),
  createdAt: ts(),
});

export const icd10Ref = pgTable('icd10_ref', {
  code: text().primaryKey(),
  name: text().notNull(),
});

export const diagnoses = pgTable('diagnoses', {
  id: uuid().primaryKey().defaultRandom(),
  medicalRecordId: uuid().notNull().references(() => medicalRecords.id, { onDelete: 'cascade' }),
  icd10Code: text().notNull().references(() => icd10Ref.code),
  icd10Name: text().notNull(),
  isPrimary: boolean().default(false).notNull(),
});

export const tariffs = pgTable('tariffs', {
  id: uuid().primaryKey().defaultRandom(),
  branchId: uuid().notNull().references(() => branches.id),
  label: text().notNull(),
  price: numeric({ precision: 12, scale: 2 }).notNull(),
  type: tariffTypeEnum().notNull(),
});

export const procedures = pgTable('procedures', {
  id: uuid().primaryKey().defaultRandom(),
  encounterId: uuid().notNull().references(() => encounters.id, { onDelete: 'cascade' }),
  tariffId: uuid().notNull().references(() => tariffs.id),
  qty: integer().notNull().default(1),
  priceSnapshot: numeric({ precision: 12, scale: 2 }).notNull(),
});

export const drugs = pgTable('drugs', {
  id: uuid().primaryKey().defaultRandom(),
  branchId: uuid().notNull().references(() => branches.id),
  name: text().notNull(),
  kind: text().notNull(),
  stock: integer().notNull().default(0),
  minStock: integer().notNull().default(0),
  price: numeric({ precision: 12, scale: 2 }).notNull(),
  expiry: date(),
  satusehatKfaCode: text(),
  createdAt: ts(),
}, (t) => [index('drugs_branch_name_idx').on(t.branchId, t.name)]);

export const stockMovements = pgTable('stock_movements', {
  id: uuid().primaryKey().defaultRandom(),
  drugId: uuid().notNull().references(() => drugs.id),
  qtyDelta: integer().notNull(),
  reason: text().notNull(),
  refType: text(),
  refId: uuid(),
  balanceAfter: integer().notNull(),
  createdBy: uuid().references(() => users.id),
  createdAt: ts(),
});

export const prescriptions = pgTable('prescriptions', {
  id: uuid().primaryKey().defaultRandom(),
  encounterId: uuid().notNull().references(() => encounters.id, { onDelete: 'cascade' }),
  patientId: uuid().notNull().references(() => patients.id),
  doctorId: uuid().notNull().references(() => users.id),
  status: rxStatusEnum().notNull().default('masuk'),
  createdAt: ts(),
  dispensedAt: timestamp({ withTimezone: true }),
  dispensedBy: uuid().references(() => users.id),
});

export const prescriptionItems = pgTable('prescription_items', {
  id: uuid().primaryKey().defaultRandom(),
  prescriptionId: uuid().notNull().references(() => prescriptions.id, { onDelete: 'cascade' }),
  drugId: uuid().notNull().references(() => drugs.id),
  qty: integer().notNull(),
  signa: text().notNull(),
  priceSnapshot: numeric({ precision: 12, scale: 2 }).notNull(),
});

export const bills = pgTable('bills', {
  id: uuid().primaryKey().defaultRandom(),
  branchId: uuid().notNull().references(() => branches.id),
  encounterId: uuid().notNull().references(() => encounters.id),
  patientId: uuid().notNull().references(() => patients.id),
  status: billStatusEnum().notNull().default('belum'),
  total: numeric({ precision: 14, scale: 2 }).notNull().default('0'),
  payMethod: payMethodEnum(),
  paidAt: timestamp({ withTimezone: true }),
  createdAt: ts(),
});

export const billItems = pgTable('bill_items', {
  id: uuid().primaryKey().defaultRandom(),
  billId: uuid().notNull().references(() => bills.id, { onDelete: 'cascade' }),
  label: text().notNull(),
  qty: integer().notNull().default(1),
  price: numeric({ precision: 12, scale: 2 }).notNull(),
  type: billItemTypeEnum().notNull(),
});

export const appointments = pgTable('appointments', {
  id: uuid().primaryKey().defaultRandom(),
  branchId: uuid().notNull().references(() => branches.id),
  doctorId: uuid().notNull().references(() => users.id),
  patientId: uuid().references(() => patients.id),
  scheduledAt: timestamp({ withTimezone: true }).notNull(),
  note: text(),
  status: appointmentStatusEnum().notNull().default('terjadwal'),
  createdAt: ts(),
});

export const outboxJobs = pgTable('outbox_jobs', {
  id: uuid().primaryKey().defaultRandom(),
  kind: outboxKindEnum().notNull(),
  payload: jsonb().notNull(),
  idempotencyKey: text().notNull(),
  status: outboxStatusEnum().notNull().default('menunggu'),
  attempts: integer().notNull().default(0),
  nextRunAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  lastError: text(),
  createdAt: ts(),
}, (t) => [
  uniqueIndex('outbox_idempotency_uniq').on(t.idempotencyKey),
  index('outbox_due_idx').on(t.status, t.nextRunAt),
]);

export const integrationCredentials = pgTable('integration_credentials', {
  id: uuid().primaryKey().defaultRandom(),
  branchId: uuid().notNull().references(() => branches.id),
  provider: text().notNull(),
  dataEncrypted: bytea().notNull(),
  updatedAt: ts(),
}, (t) => [uniqueIndex('integration_branch_provider_uniq').on(t.branchId, t.provider)]);

export const documents = pgTable('documents', {
  id: uuid().primaryKey().defaultRandom(),
  branchId: uuid().notNull().references(() => branches.id),
  encounterId: uuid().references(() => encounters.id),
  patientId: uuid().notNull().references(() => patients.id),
  doctorId: uuid().notNull().references(() => users.id),
  type: documentTypeEnum().notNull(),
  number: text().notNull(),
  data: jsonb().notNull(),
  createdAt: ts(),
}, (t) => [
  uniqueIndex('documents_branch_number_uniq').on(t.branchId, t.number),
  index('documents_patient_idx').on(t.patientId),
]);

export const auditLogs = pgTable('audit_logs', {
  id: uuid().primaryKey().defaultRandom(),
  actorId: uuid().references(() => users.id),
  action: text().notNull(),
  entity: text().notNull(),
  entityId: text(),
  meta: jsonb(),
  ip: text(),
  createdAt: ts(),
}, (t) => [index('audit_entity_idx').on(t.entity, t.entityId)]);

export const patientsRelations = relations(patients, ({ many, one }) => ({
  encounters: many(encounters),
  branch: one(branches, { fields: [patients.branchId], references: [branches.id] }),
}));
export const encountersRelations = relations(encounters, ({ one, many }) => ({
  patient: one(patients, { fields: [encounters.patientId], references: [patients.id] }),
  doctor: one(users, { fields: [encounters.doctorId], references: [users.id] }),
  vital: many(vitalSigns),
  rme: many(medicalRecords),
  procedures: many(procedures),
}));
