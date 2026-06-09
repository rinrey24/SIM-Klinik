import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db/client';
import { logger } from '@/lib/logger';
import {
  fhirPost, resolveIhsByNik, satusehatConfigured, IntegrationNotConfigured,
} from './client';
import {
  buildEncounter, buildCondition, buildObservation, buildMedicationRequest, VITAL_KINDS,
} from './mappers';

const {
  encounters, patients, users, vitalSigns, medicalRecords, diagnoses,
  prescriptions, prescriptionItems, drugs, auditLogs,
} = schema;

type PostResult = { id?: string };

/**
 * Submisi satu kunjungan ke SATUSEHAT (asinkron, dipanggil worker).
 * Throw IntegrationNotConfigured bila kredensial kosong (worker akan tunda).
 * Throw Error biasa bila gagal (worker akan retry/backoff).
 */
export async function submitEncounterToSatusehat(encounterId: string): Promise<{ satusehatEncounterId: string }> {
  if (!satusehatConfigured()) throw new IntegrationNotConfigured('SATUSEHAT');

  const [enc] = await db.select().from(encounters).where(eq(encounters.id, encounterId)).limit(1);
  if (!enc) throw new Error(`Encounter ${encounterId} tidak ditemukan`);

  const [patient] = await db.select().from(patients).where(eq(patients.id, enc.patientId)).limit(1);
  const [doctor] = await db.select().from(users).where(eq(users.id, enc.doctorId)).limit(1);
  if (!patient || !doctor) throw new Error('Data pasien/dokter tidak lengkap');
  if (!doctor.satusehatPractitionerId) throw new Error('Dokter belum punya satusehat_practitioner_id');
  if (!patient.nik) throw new Error('Pasien tidak punya NIK untuk resolusi IHS');

  // 1. Resolusi/ensure IHS pasien
  let ihsId = patient.satusehatIhsId;
  if (!ihsId) {
    ihsId = await resolveIhsByNik(patient.nik);
    if (!ihsId) throw new Error('IHS pasien tidak ditemukan di SATUSEHAT (cek NIK)');
    await db.update(patients).set({ satusehatIhsId: ihsId }).where(eq(patients.id, patient.id));
  }

  // 2. POST Encounter
  const start = (enc.startedAt ?? enc.arrivedAt).toISOString();
  const end = (enc.finishedAt ?? new Date()).toISOString();
  const encRes = await fhirPost<PostResult>('Encounter', buildEncounter({
    ihsId, patientName: patient.name,
    practitionerId: doctor.satusehatPractitionerId, practitionerName: doctor.name,
    start, end,
  }));
  const satusehatEncounterId = encRes.id;
  if (!satusehatEncounterId) throw new Error('SATUSEHAT tidak mengembalikan Encounter id');

  // 3. Condition per diagnosis
  const [mr] = await db.select().from(medicalRecords).where(eq(medicalRecords.encounterId, encounterId)).limit(1);
  if (mr) {
    const dxs = await db.select().from(diagnoses).where(eq(diagnoses.medicalRecordId, mr.id));
    for (const dx of dxs) {
      await fhirPost('Condition', buildCondition({
        encounterId: satusehatEncounterId, ihsId, patientName: patient.name,
        icd10Code: dx.icd10Code, icd10Name: dx.icd10Name,
      }));
    }
  }

  // 4. Observation per vital
  const [vital] = await db.select().from(vitalSigns).where(eq(vitalSigns.encounterId, encounterId)).limit(1);
  if (vital) {
    const effective = (vital.recordedAt ?? new Date()).toISOString();
    const values: Record<string, number | null> = {
      nadi: vital.nadi, suhu: vital.suhu ? Number(vital.suhu) : null, rr: vital.rr,
      spo2: vital.spo2, bb: vital.bb ? Number(vital.bb) : null, tb: vital.tb ? Number(vital.tb) : null,
    };
    for (const kind of VITAL_KINDS) {
      const value = values[kind];
      if (value == null || Number.isNaN(value)) continue;
      await fhirPost('Observation', buildObservation({
        encounterId: satusehatEncounterId, ihsId, patientName: patient.name, kind, value, effective,
      }));
    }
  }

  // 5. MedicationRequest per item resep
  const [rx] = await db.select().from(prescriptions).where(eq(prescriptions.encounterId, encounterId)).limit(1);
  if (rx) {
    const items = await db.select({
      qty: prescriptionItems.qty, signa: prescriptionItems.signa,
      drugName: drugs.name, kfaCode: drugs.satusehatKfaCode,
    })
      .from(prescriptionItems)
      .innerJoin(drugs, eq(drugs.id, prescriptionItems.drugId))
      .where(eq(prescriptionItems.prescriptionId, rx.id));
    for (const it of items) {
      await fhirPost('MedicationRequest', buildMedicationRequest({
        encounterId: satusehatEncounterId, ihsId, patientName: patient.name,
        practitionerId: doctor.satusehatPractitionerId, drugName: it.drugName,
        kfaCode: it.kfaCode, signa: it.signa, qty: it.qty,
      }));
    }
  }

  // 6. Update status + audit
  await db.update(encounters)
    .set({ satusehatEncounterId, syncStatus: 'tersinkron' })
    .where(eq(encounters.id, encounterId));
  if (mr) await db.update(medicalRecords).set({ syncStatus: 'tersinkron' }).where(eq(medicalRecords.id, mr.id));
  await db.insert(auditLogs).values({
    actorId: null, action: 'satusehat_submit', entity: 'encounter', entityId: encounterId,
    meta: { satusehatEncounterId },
  });

  logger.info({ encounterId, satusehatEncounterId }, 'SATUSEHAT submit sukses');
  return { satusehatEncounterId };
}
