import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { hash } from 'argon2';
import * as schema from './schema';
import { eq } from 'drizzle-orm';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(sql, { schema, casing: 'snake_case' });

  console.log('🌱 Seeding…');

  let [branch] = await db.select().from(schema.branches).limit(1);
  if (!branch) {
    [branch] = await db.insert(schema.branches).values({
      name: 'Klinik Sehat Bersama',
      address: 'Jl. Merdeka Raya No. 45, Bandung',
      phone: '022-7301122',
      accentColor: '#0d9488',
    }).returning();
    console.log('  + branch', branch.name);
  }

  const pw = await hash('rahasia123');
  type Role = 'admin' | 'pendaftaran' | 'dokter' | 'perawat' | 'apoteker' | 'kasir';
  const userSpecs: { email: string; role: Role; name: string; sip?: string }[] = [
    { email: 'admin@kliniksehatbersama.id', role: 'admin', name: 'Rizki Maulana' },
    { email: 'pendaftaran@kliniksehatbersama.id', role: 'pendaftaran', name: 'Wulan Sari' },
    { email: 'dr.andini@kliniksehatbersama.id', role: 'dokter', name: 'dr. Andini Pratama', sip: 'SIP.446/0123' },
    { email: 'perawat.dewi@kliniksehatbersama.id', role: 'perawat', name: 'Ns. Dewi Anjani' },
    { email: 'apt.rangga@kliniksehatbersama.id', role: 'apoteker', name: 'Apt. Rangga S.' },
    { email: 'kasir@kliniksehatbersama.id', role: 'kasir', name: 'Maya Putri' },
  ];
  for (const u of userSpecs) {
    const existing = await db.select().from(schema.users).where(eq(schema.users.email, u.email)).limit(1);
    if (existing.length) continue;
    await db.insert(schema.users).values({
      branchId: branch.id, email: u.email, name: u.name, passwordHash: pw,
      role: u.role, sip: u.sip ?? null, active: true,
    });
    console.log('  + user', u.email, '(rahasia123)');
  }

  const icd: { code: string; name: string }[] = [
    { code: 'J06.9', name: 'Infeksi saluran napas atas akut' },
    { code: 'I10', name: 'Hipertensi esensial (primer)' },
    { code: 'K29.7', name: 'Gastritis, tidak spesifik' },
    { code: 'J00', name: 'Nasofaringitis akut (common cold)' },
    { code: 'R51', name: 'Sakit kepala' },
    { code: 'L29.9', name: 'Pruritus, tidak spesifik' },
    { code: 'E11.9', name: 'Diabetes melitus tipe 2 tanpa komplikasi' },
    { code: 'A09', name: 'Diare & gastroenteritis' },
    { code: 'M79.1', name: 'Mialgia' },
    { code: 'R50.9', name: 'Demam, tidak spesifik' },
  ];
  await db.insert(schema.icd10Ref).values(icd).onConflictDoNothing();
  console.log('  + ICD-10 references');

  const existingDrugs = await db.select().from(schema.drugs).limit(1);
  if (!existingDrugs.length) {
    await db.insert(schema.drugs).values([
      { branchId: branch.id, name: 'Paracetamol 500mg', kind: 'Tablet', stock: 1240, minStock: 300, price: '500', expiry: '2027-08-31' },
      { branchId: branch.id, name: 'Amoxicillin 500mg', kind: 'Kapsul', stock: 86, minStock: 200, price: '1200', expiry: '2027-03-31' },
      { branchId: branch.id, name: 'Amlodipine 10mg', kind: 'Tablet', stock: 540, minStock: 150, price: '800', expiry: '2026-11-30' },
      { branchId: branch.id, name: 'Omeprazole 20mg', kind: 'Kapsul', stock: 312, minStock: 120, price: '1500', expiry: '2027-01-31' },
      { branchId: branch.id, name: 'Cetirizine 10mg', kind: 'Tablet', stock: 45, minStock: 100, price: '700', expiry: '2026-07-31' },
      { branchId: branch.id, name: 'Metformin 500mg', kind: 'Tablet', stock: 720, minStock: 200, price: '600', expiry: '2027-05-31' },
      { branchId: branch.id, name: 'OBH Combi Sirup', kind: 'Botol', stock: 28, minStock: 40, price: '18500', expiry: '2026-09-30' },
      { branchId: branch.id, name: 'Vitamin B Complex', kind: 'Tablet', stock: 980, minStock: 150, price: '400', expiry: '2028-02-29' },
    ]);
    console.log('  + drugs');
  }

  const existingTariff = await db.select().from(schema.tariffs).limit(1);
  if (!existingTariff.length) {
    await db.insert(schema.tariffs).values([
      { branchId: branch.id, label: 'Konsultasi Dokter Umum', price: '50000', type: 'jasa' },
      { branchId: branch.id, label: 'Administrasi', price: '10000', type: 'jasa' },
      { branchId: branch.id, label: 'Tindakan Nebulizer', price: '75000', type: 'tindakan' },
      { branchId: branch.id, label: 'Perawatan Luka (Hecting)', price: '120000', type: 'tindakan' },
      { branchId: branch.id, label: 'Injeksi', price: '35000', type: 'tindakan' },
      { branchId: branch.id, label: 'EKG', price: '90000', type: 'tindakan' },
      { branchId: branch.id, label: 'Cek Gula Darah', price: '25000', type: 'tindakan' },
    ]);
    console.log('  + tariffs');
  }

  const existingPatient = await db.select().from(schema.patients).limit(1);
  if (!existingPatient.length) {
    await db.insert(schema.patients).values([
      { branchId: branch.id, rmNumber: 'RM-000001', nik: '3273014509900002', name: 'Siti Nurhaliza', sex: 'P', dob: '1990-09-14', phone: '0812-3344-5566', address: 'Jl. Cihampelas No. 12, Bandung', penjamin: 'BPJS', bpjsNumber: '0001234567890', allergies: 'Amoxicillin' },
      { branchId: branch.id, rmNumber: 'RM-000002', nik: '3273012003850007', name: 'Budi Santoso', sex: 'L', dob: '1985-03-20', phone: '0813-9988-7766', address: 'Jl. Dago No. 88, Bandung', penjamin: 'Umum' },
      { branchId: branch.id, rmNumber: 'RM-000003', nik: '3273015511780011', name: 'Rina Wulandari', sex: 'P', dob: '1978-11-15', phone: '0857-1122-3344', address: 'Jl. Pasteur No. 5, Bandung', penjamin: 'BPJS', bpjsNumber: '0009876543210' },
    ]);
    console.log('  + sample patients');
  }

  console.log('✅ Seed selesai.');
  console.log('   Login dengan email di atas, password: rahasia123');
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
