// FHIR R4 mappers (subset) untuk SATUSEHAT. Tipe diketik minimal secara lokal
// agar tidak menambah dependency @types/fhir.
import { env } from '@/lib/env';

export interface EncounterInput {
  ihsId: string;
  patientName: string;
  practitionerId: string;
  practitionerName: string;
  start: string; // ISO
  end: string;   // ISO
}

export function buildEncounter(i: EncounterInput) {
  return {
    resourceType: 'Encounter',
    status: 'finished',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
    subject: { reference: `Patient/${i.ihsId}`, display: i.patientName },
    participant: [{
      type: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'ATND', display: 'attender' }] }],
      individual: { reference: `Practitioner/${i.practitionerId}`, display: i.practitionerName },
    }],
    period: { start: i.start, end: i.end },
    serviceProvider: { reference: `Organization/${env.SATUSEHAT_ORG_ID}` },
  };
}

export interface ConditionInput {
  encounterId: string;
  ihsId: string;
  patientName: string;
  icd10Code: string;
  icd10Name: string;
}

export function buildCondition(i: ConditionInput) {
  return {
    resourceType: 'Condition',
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'encounter-diagnosis', display: 'Encounter Diagnosis' }] }],
    code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: i.icd10Code, display: i.icd10Name }] },
    subject: { reference: `Patient/${i.ihsId}`, display: i.patientName },
    encounter: { reference: `Encounter/${i.encounterId}` },
  };
}

// Observation kode LOINC umum untuk tanda vital
const VITAL_LOINC: Record<string, { code: string; display: string; unit: string }> = {
  nadi: { code: '8867-4', display: 'Heart rate', unit: '/min' },
  suhu: { code: '8310-5', display: 'Body temperature', unit: 'Cel' },
  rr: { code: '9279-1', display: 'Respiratory rate', unit: '/min' },
  spo2: { code: '59408-5', display: 'Oxygen saturation', unit: '%' },
  bb: { code: '29463-7', display: 'Body weight', unit: 'kg' },
  tb: { code: '8302-2', display: 'Body height', unit: 'cm' },
};

export interface ObservationInput {
  encounterId: string;
  ihsId: string;
  patientName: string;
  kind: keyof typeof VITAL_LOINC;
  value: number;
  effective: string; // ISO
}

export function buildObservation(i: ObservationInput) {
  const meta = VITAL_LOINC[i.kind];
  return {
    resourceType: 'Observation',
    status: 'final',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs', display: 'Vital Signs' }] }],
    code: { coding: [{ system: 'http://loinc.org', code: meta.code, display: meta.display }] },
    subject: { reference: `Patient/${i.ihsId}`, display: i.patientName },
    encounter: { reference: `Encounter/${i.encounterId}` },
    effectiveDateTime: i.effective,
    valueQuantity: { value: i.value, unit: meta.unit, system: 'http://unitsofmeasure.org', code: meta.unit },
  };
}

export const VITAL_KINDS = Object.keys(VITAL_LOINC) as (keyof typeof VITAL_LOINC)[];

export interface MedicationRequestInput {
  encounterId: string;
  ihsId: string;
  patientName: string;
  practitionerId: string;
  drugName: string;
  kfaCode?: string | null;
  signa: string;
  qty: number;
}

export function buildMedicationRequest(i: MedicationRequestInput) {
  return {
    resourceType: 'MedicationRequest',
    status: 'active',
    intent: 'order',
    subject: { reference: `Patient/${i.ihsId}`, display: i.patientName },
    encounter: { reference: `Encounter/${i.encounterId}` },
    requester: { reference: `Practitioner/${i.practitionerId}` },
    medicationCodeableConcept: i.kfaCode
      ? { coding: [{ system: 'http://sys-ids.kemkes.go.id/kfa', code: i.kfaCode, display: i.drugName }], text: i.drugName }
      : { text: i.drugName },
    dosageInstruction: [{ text: i.signa }],
    dispenseRequest: { quantity: { value: i.qty } },
  };
}
