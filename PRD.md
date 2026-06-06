# PRD — SIM Klinik (Sistem Informasi Manajemen Klinik)

**Versi:** 1.0  ·  **Tanggal:** 06/06/2026  ·  **Status:** Draft untuk implementasi (vibe coding)
**Pemilik produk:** —  ·  **Target:** Klinik Umum (FKTP), satu klinik, *multi-branch ready*

> Dokumen ini adalah satu-satunya sumber kebenaran untuk membangun SIM Klinik secara *fullstack*. Ditujukan langsung untuk coding agent (mis. Claude Code) dan developer. Desain visual mengikuti *handoff bundle* dari Claude Design (proyek **SIM Klinik**). Recreate desain secara pixel-perfect; PRD ini menambahkan lapisan data, API, integrasi, keamanan, dan operasional.

---

## Daftar Isi
1. [Ringkasan Produk](#1-ringkasan-produk)
2. [Tujuan, Sasaran & Non-Goals](#2-tujuan-sasaran--non-goals)
3. [Pengguna, Peran & RBAC](#3-pengguna-peran--rbac)
4. [Lingkup Fungsional per Modul](#4-lingkup-fungsional-per-modul)
5. [Alur Utama (End-to-End)](#5-alur-utama-end-to-end)
6. [Arsitektur Sistem](#6-arsitektur-sistem)
7. [Tech Stack](#7-tech-stack)
8. [Model Data (Drizzle + Postgres)](#8-model-data-drizzle--postgres)
9. [Design System](#9-design-system)
10. [Autentikasi & Otorisasi](#10-autentikasi--otorisasi)
11. [Desain API Internal](#11-desain-api-internal)
12. [Integrasi Eksternal (API-call ready)](#12-integrasi-eksternal-api-call-ready)
13. [Observability: Logging, Error, Audit](#13-observability-logging-error-audit)
14. [Keamanan & Kepatuhan](#14-keamanan--kepatuhan)
15. [Kualitas: Testing, CI/CD, Performa](#15-kualitas-testing-cicd-performa)
16. [Struktur Proyek](#16-struktur-proyek)
17. [Environment Variables](#17-environment-variables)
18. [Roadmap & Fase](#18-roadmap--fase)
19. [Lampiran: Contoh Kontrak Integrasi](#19-lampiran-contoh-kontrak-integrasi)

---

## 1. Ringkasan Produk

SIM Klinik mendigitalkan seluruh alur kerja klinik umum dalam satu sistem terpusat dan real-time: pasien daftar → masuk antrian → diperiksa dokter (RME) → tebus obat di apotek → bayar di kasir. Setiap modul saling terhubung sehingga tidak ada input ganda; tindakan dokter dan obat yang ditebus otomatis mengalir ke tagihan kasir, dan resep otomatis memotong stok farmasi.

Sistem wajib patuh **Permenkes No. 24/2022** (penyelenggaraan Rekam Medis Elektronik) dan **interoperabel dengan platform SATUSEHAT** (HL7 FHIR R4), serta siap *bridging* **BPJS Kesehatan** (PCare untuk FKTP). Antarmuka **mobile-first**, Bahasa Indonesia, mata uang Rupiah, format tanggal `DD/MM/YYYY`, zona waktu `Asia/Jakarta`.

---

## 2. Tujuan, Sasaran & Non-Goals

### 2.1 Tujuan
- Operasional klinik berjalan tanpa kertas, satu alur data dari pendaftaran sampai kasir.
- Kepatuhan RME & SATUSEHAT terpenuhi sejak fase awal (minimal: status sinkronisasi tampil di UI; submisi FHIR berjalan asinkron).
- Pengalaman staf cepat: tugas tersering selesai dalam klik minimal.

### 2.2 Sasaran terukur (acceptance)
- Pendaftaran pasien lama < 10 detik (pencarian → pilih → masuk antrian).
- Dokter menyelesaikan RME satu kunjungan (SOAP + dx + resep) < 2 menit dengan data contoh.
- Tagihan kasir terbentuk otomatis 100% dari tindakan + obat tanpa input ulang.
- Submisi SATUSEHAT (Encounter + Condition + Observation) tercatat statusnya per kunjungan dengan retry otomatis.

### 2.3 Non-Goals (fase ini)
- **Portal/aplikasi pasien** (antrian online mandiri) — *belum* dibangun, tapi disiapkan titik integrasinya (lihat §4.3).
- **Multi-cabang aktif** — UI satu klinik, namun skema data & sesi sudah membawa `branch_id` (lihat §6.3, §8).
- Spesialisasi non-umum (gigi, lab, radiologi), telemedisin, klaim BPJS FKRTL (VClaim), modul HRD/payroll.

---

## 3. Pengguna, Peran & RBAC

Enam peran staf. Navigasi & kapabilitas menyesuaikan peran (sesuai desain).

| Peran | Key | Warna | Navigasi default |
|---|---|---|---|
| Admin / Manajemen | `admin` | violet | dashboard, antrian, jadwal, laporan, farmasi, pengaturan |
| Petugas Pendaftaran | `pendaftaran` | sky | pendaftaran, antrian, jadwal |
| Dokter Umum | `dokter` | teal | antrian, rme, jadwal |
| Perawat | `perawat` | green | antrian, pendaftaran |
| Apoteker | `apoteker` | amber | farmasi |
| Kasir | `kasir` | red | kasir, antrian |

### 3.1 Matriks hak akses (ringkas)

| Kapabilitas | admin | pendaftaran | dokter | perawat | apoteker | kasir |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Lihat dashboard & laporan | ✅ | — | — | — | — | — |
| Daftar/cari pasien, buat RM | ✅ | ✅ | r | ✅ | — | r |
| Kelola antrian (panggil/ubah status) | ✅ | ✅ | ✅ | ✅ | — | r |
| Input vital sign | ✅ | — | ✅ | ✅ | — | — |
| Tulis RME (SOAP, dx ICD-10, tindakan) | — | — | ✅ | — | — | — |
| Buat resep | — | — | ✅ | — | — | — |
| Kelola farmasi & stok, serahkan obat | ✅ | — | — | — | ✅ | — |
| Proses tagihan & pembayaran | ✅ | — | — | — | — | ✅ |
| Kelola user, tarif, integrasi | ✅ | — | — | — | — | — |

`r` = read-only. Otorisasi ditegakkan **di server** (route handler) berdasarkan klaim peran pada JWT, bukan hanya disembunyikan di UI.

---

## 4. Lingkup Fungsional per Modul

Sembilan modul. Setiap *user story* di bawah harus punya state kosong, loading skeleton, dan error ramah (Bahasa Indonesia).

### 4.1 Dashboard (`/dashboard`)
- Kartu KPI: pasien hari ini (+tren), antrian aktif, pendapatan hari ini (+tren), stok obat menipis.
- Grafik tren kunjungan 7 hari (line/bar), komposisi penjamin (BPJS/Umum/Asuransi), breakdown pendapatan (jasa/tindakan/obat).
- Data agregat dihitung server-side untuk hari berjalan, scoped `branch_id`.

### 4.2 Pendaftaran & Pencarian Pasien (`/pendaftaran`)
- Pencarian pasien lama by **NIK / No. RM / nama / No. HP** (debounced, server-side).
- Form pasien baru: NIK (16 digit, validasi), nama, jenis kelamin, tgl lahir, HP, alamat, **penjamin** (BPJS/Umum/Asuransi), No. BPJS (jika BPJS), alergi.
- Aksi "Daftarkan ke Antrian": pilih dokter → buat `encounter` status `menunggu` + nomor antrian otomatis (mis. `A-00X`).
- Jika penjamin BPJS: tombol opsional "Cek Peserta (PCare)" → panggil BPJS PCare untuk validasi kepesertaan (lihat §12.2).

### 4.3 Antrian (`/antrian`)
- Papan antrian poli umum, status: `menunggu → dipanggil → dilayani → selesai` (warna: kuning/sky/teal/green).
- Tombol "Panggil Berikutnya" & ubah status. Update real-time (lihat §6.4).
- **Disiapkan untuk fase pasien:** abstraksi sumber antrian (`source: 'walk_in' | 'online'`) sudah ada di skema; endpoint pembuatan antrian online tinggal mengaktifkan rute publik.

### 4.4 Jadwal & Janji Temu (`/jadwal`)
- Kalender jadwal praktik dokter; slot per jam; penanda `terjadwal | kosong | cuti/penuh`.
- Buat/ubah/batalkan janji; reminder WhatsApp opsional (lihat §12.3).

### 4.5 Rekam Medis Elektronik / RME (`/rme`)
- Daftar antrian "dilayani/dipanggil" → buka kunjungan.
- Panel: identitas + **badge alergi**, vital sign (TD, nadi, suhu, RR, SpO₂, BB, TB), **SOAP**, **diagnosa ICD-10** (autocomplete dari referensi), **tindakan** (dari tarif), **resep**.
- **Riwayat kunjungan kronologis** dengan **badge status SATUSEHAT** (`tersinkron | menunggu | gagal`).
- Saat kunjungan ditutup: trigger pembuatan job submisi FHIR (Encounter→Condition→Observation→MedicationRequest) ke outbox (asinkron, lihat §12.1).

### 4.6 Farmasi / Apotek (`/farmasi`)
- Antrean resep masuk (`masuk → disiapkan → diserahkan`).
- Stok obat real-time; **potong stok otomatis** saat resep diserahkan (tulis `stock_movements`, transaksional).
- **Alert** stok ≤ `min_stock` (merah) & mendekati kedaluwarsa (amber). Daftar inventaris dengan filter.

### 4.7 Kasir / Billing (`/kasir`)
- Tagihan terbentuk otomatis menggabungkan **jasa (konsultasi/admin) + tindakan + obat** dari kunjungan.
- Metode bayar: tunai, **QRIS**, kartu, BPJS (tanpa tagih untuk peserta tertanggung).
- Cetak/kirim nota digital (print CSS + opsi WhatsApp/email). Status `belum → lunas`.

### 4.8 Laporan (`/laporan`)
- Keuangan harian/periode, kunjungan, obat terlaris, performa dokter, komposisi penjamin.
- Ekspor CSV/XLSX (server-generated). Filter rentang tanggal & (kelak) cabang.

### 4.9 Pengaturan (`/pengaturan`)
- Profil klinik (nama, alamat, **logo & warna brand** dapat diganti → memengaruhi token `--accent`).
- Kelola user & peran, daftar dokter (SIP), tarif jasa/tindakan.
- **Integrasi:** kredensial SATUSEHAT, BPJS, WhatsApp (disimpan terenkripsi, lihat §14).
- Placeholder **"Cabang"** dalam keadaan terkunci/nonaktif sebagai penanda pengembangan multi-cabang.

---

## 5. Alur Utama (End-to-End)

```
Pendaftaran                Antrian            RME (Dokter)              Farmasi              Kasir
─────────────              ───────            ────────────              ───────              ─────
Cari/registrasi pasien  →  Buat antrian   →   Perawat input vital   →   Resep masuk      →   Tagihan auto
(penjamin, BPJS check)     status=menunggu    Dokter SOAP+dx+resep      potong stok          (jasa+tindakan+obat)
                                              +tindakan → tutup         serahkan obat        bayar → lunas
                                              ↓ (async)                                      ↓
                                      Outbox → SATUSEHAT FHIR                          Nota digital
                                      (Encounter/Condition/Observation/MedicationRequest)
```

Prinsip: **single source of truth** per `encounter`. Tindakan & obat menempel ke encounter; kasir membaca dari sana. Tidak ada re-entry.

---

## 6. Arsitektur Sistem

### 6.1 Gaya arsitektur
- **Next.js (App Router)** sebagai full-stack tunggal: Server Components untuk read berat (dashboard, daftar), Route Handlers (`app/api/**`) sebagai REST API untuk mutasi & integrasi.
- **Layered**: `routes (api) → services (domain) → repositories (drizzle) → db`. Integrasi eksternal di `lib/integrations/*` dengan antarmuka client yang bersih.
- **Validation di batas**: setiap input divalidasi dengan **Zod** (skema dibagikan client/server).

### 6.2 Asinkron & keandalan
- Submisi SATUSEHAT, kiriman WhatsApp, dan klaim BPJS bersifat **asinkron** lewat **pola outbox + worker (BullMQ/Redis)** dengan **retry + exponential backoff** dan **idempotency key**. UI hanya menampilkan status; kegagalan integrasi tidak boleh memblok pelayanan pasien.

### 6.3 Multi-tenant (branch) readiness
- Semua tabel transaksional punya kolom `branch_id` (untuk sekarang di-seed satu klinik default).
- `branch_id` aktif dibawa di **JWT/session** dan disuntikkan otomatis ke semua query repository (row-scoping). Saat multi-cabang diaktifkan, cukup munculkan *branch switcher* di header & longgarkan scoping.

### 6.4 Real-time antrian
- Fase 1: **polling ringan via TanStack Query** (`refetchInterval`) — sederhana & andal.
- Fase 2 (opsional): Server-Sent Events / WebSocket untuk papan antrian & RME live.

---

## 7. Tech Stack

Stack inti sesuai permintaan + rekomendasi pelengkap. Pilih versi stabil terbaru saat implementasi.

### 7.1 Inti (wajib)
| Area | Pilihan | Catatan |
|---|---|---|
| Framework | **Next.js (App Router)** | "router" = App Router; SSR/RSC + Route Handlers |
| UI | **React + TypeScript** | strict mode TS |
| Styling | **Tailwind CSS** | konfigurasi token dari design system (§9) |
| Komponen | **shadcn/ui** (+ Radix UI) | dipadukan token teal; ikon **lucide-react** (sesuai desain) |
| ORM | **Drizzle ORM** + drizzle-kit | migrasi versioned |
| Database | **PostgreSQL** | data RME → residensi data Indonesia (lihat §14) |
| Auth | **JWT** (lib `jose`) | access + refresh token, httpOnly cookie (§10) |
| Data fetching | **TanStack Query** | server-state, cache, polling antrian |
| Tabel | **TanStack Table** | tabel pasien/stok/laporan |
| Logging | **Pino** | structured JSON log + redaction PII |
| Error monitoring | **Sentry** | client + server + source maps |

### 7.2 Rekomendasi pelengkap
| Area | Pilihan | Alasan |
|---|---|---|
| Validasi & tipe | **Zod** | satu skema dipakai client form + server API + parsing env |
| Form | **React Hook Form** + `@hookform/resolvers/zod` | form pendaftaran/RME besar, performa baik |
| State ringan | **Zustand** | mirror pola `store.jsx` desain (role, theme, tweaks) |
| Chart | **Recharts** | grafik dashboard sesuai desain |
| Tanggal | **date-fns** + **date-fns-tz** | `Asia/Jakarta`, format `dd/MM/yyyy` |
| Queue/worker | **BullMQ** + **Redis** | outbox SATUSEHAT/WhatsApp, retry/backoff |
| BPJS client | **`@ssecd/jkn`** (npm) | wrapper bridging BPJS (PCare/VClaim/Antrean) — hindari hand-roll signature/dekripsi |
| FHIR typing | **`@types/fhir`** (R4) | tipe resource FHIR untuk SATUSEHAT |
| Password hash | **argon2** (atau bcrypt) | hashing kredensial user |
| Env validation | Zod-based (`env.ts`) atau `@t3-oss/env-nextjs` | gagal-cepat saat env kurang |
| Email/WA | provider WhatsApp Business API / email transaksional | notifikasi (§12.3) |
| Print/PDF | print CSS + opsi `@react-pdf/renderer` | nota kasir; siap printer termal |
| Testing | **Vitest** + Testing Library + **Playwright** | unit/integration + e2e alur inti |
| Lint/format | ESLint + Prettier (atau **Biome**) | konsistensi |
| Container | Docker + docker-compose | Postgres + Redis lokal/produksi |
| CI/CD | GitHub Actions | lint, typecheck, test, migrate, build |
| Monorepo (opsional) | pnpm workspaces / Turborepo | bila kelak pisah `apps/*` (staf, portal pasien) |

> **Catatan tRPC:** bila ingin type-safety end-to-end penuh, tRPC bisa menggantikan sebagian Route Handlers internal. Namun integrasi eksternal (SATUSEHAT/BPJS) dan endpoint publik tetap REST. Default PRD: **Route Handlers REST + Zod**.

---

## 8. Model Data (Drizzle + Postgres)

Skema diturunkan dari `data.js` desain + kebutuhan integrasi. Semua tabel transaksional membawa `branch_id`. Waktu disimpan `timestamptz`.

### 8.1 Enum
```ts
// drizzle/schema/enums.ts
export const roleEnum       = pgEnum('role', ['admin','pendaftaran','dokter','perawat','apoteker','kasir']);
export const penjaminEnum   = pgEnum('penjamin', ['BPJS','Umum','Asuransi']);
export const queueStatus    = pgEnum('queue_status', ['menunggu','dipanggil','dilayani','selesai','batal']);
export const queueSource    = pgEnum('queue_source', ['walk_in','online']);          // online = fase pasien
export const rxStatus       = pgEnum('rx_status', ['masuk','disiapkan','diserahkan','batal']);
export const billStatus     = pgEnum('bill_status', ['belum','lunas','batal']);
export const billItemType   = pgEnum('bill_item_type', ['jasa','tindakan','obat']);
export const payMethod       = pgEnum('pay_method', ['tunai','qris','kartu','bpjs']);
export const syncStatus     = pgEnum('sync_status', ['menunggu','tersinkron','gagal']);
export const tariffType     = pgEnum('tariff_type', ['jasa','tindakan']);
```

### 8.2 Tabel inti (ringkas — tipe Drizzle)
```ts
// branches — multi-branch ready (seed 1 default)
branches      { id, name, address, phone, logo_url, accent_color, satusehat_org_id, created_at }

// users — semua staf; field dokter (sip, satusehat_practitioner_id) nullable
users         { id, branch_id, name, email(unique), password_hash, role, sip, satusehat_practitioner_id,
                bpjs_dokter_kode, active, created_at }
sessions      { id, user_id, refresh_token_hash, user_agent, ip, expires_at, revoked_at, created_at }

patients      { id, branch_id, rm_number(unique per branch), nik, name, sex, dob, phone, address,
                penjamin, bpjs_number, satusehat_ihs_id, allergies, created_at }

doctors_view  // dokter = users where role='dokter' (tidak perlu tabel terpisah)

encounters    { id, branch_id, queue_no, patient_id, doctor_id, status, source, complaint,
                arrived_at, started_at, finished_at, satusehat_encounter_id, sync_status, created_at }
vital_signs   { id, encounter_id, td, nadi, suhu, rr, spo2, bb, tb, recorded_by, recorded_at }

medical_records { id, encounter_id, patient_id, doctor_id, s, o, a, p, sync_status, created_at }
diagnoses     { id, medical_record_id, icd10_code, icd10_name, is_primary }
icd10_ref     { code(pk), name }   // referensi, seed dari data + master Kemenkes

procedures    { id, encounter_id, tariff_id, qty, price_snapshot }   // tindakan pada kunjungan

drugs         { id, branch_id, name, kind, stock, min_stock, price, expiry, satusehat_kfa_code, created_at }
stock_movements { id, drug_id, qty_delta, reason, ref_type, ref_id, balance_after, created_by, created_at }

prescriptions { id, encounter_id, patient_id, doctor_id, status, created_at, dispensed_at, dispensed_by }
prescription_items { id, prescription_id, drug_id, qty, signa, price_snapshot }

tariffs       { id, branch_id, label, price, type }

bills         { id, branch_id, encounter_id, patient_id, status, total, pay_method, paid_at, created_at }
bill_items    { id, bill_id, label, qty, price, type }

appointments  { id, branch_id, doctor_id, patient_id, scheduled_at, note, status, created_at }

// Integrasi & audit
outbox_jobs   { id, kind('satusehat'|'whatsapp'|'bpjs'), payload(jsonb), idempotency_key(unique),
                status, attempts, next_run_at, last_error, created_at }
integration_credentials { id, branch_id, provider, data_encrypted(bytea), updated_at }  // §14
audit_logs    { id, actor_id, action, entity, entity_id, meta(jsonb), ip, created_at }
```

### 8.3 Aturan integritas penting
- **Potong stok** hanya lewat `stock_movements` dalam **transaksi** yang juga mengubah `drugs.stock` (hindari race; gunakan `SELECT … FOR UPDATE` / serializable saat dispensing).
- **Tagihan** dirakit dari `procedures` + `prescription_items` (diserahkan) + tarif jasa default → tulis `bill_items` snapshot harga (harga historis tak berubah).
- `rm_number` unik per `branch_id`. `nik` 16 digit (validasi, tidak harus unik — kasus bayi/numpang).
- Semua mutasi penting menulis `audit_logs`.

---

## 9. Design System

Sumber: `tokens.css` & komponen dari handoff bundle. **Recreate pixel-perfect** ke Tailwind + shadcn/ui.

### 9.1 Token
- **Font:** `Plus Jakarta Sans` (fallback system-ui).
- **Aksen:** teal — `--accent: #0d9488` (teal-600); skala teal 700→50. Brand color dari Pengaturan menimpa `--accent`.
- **Status:** green `#16a34a` (selesai/ok), amber `#d97706` (menunggu/peringatan ringan), red `#dc2626` (kritis/stok habis), sky `#0284c7`, violet `#7c3aed`.
- **Netral (light):** bg `#f4f7f8`, surface `#ffffff`, line `#e6ecec`, ink `#0f1f1e` → ink-4 `#9aa9a8`.
- **Dark mode:** via `[data-theme="dark"]` di root frame (bg `#0a1413`, surface `#0f1c1b`, dst).
- **Radius:** 8/12/16/22px. **Shadow:** sm/md/lg lembut bernuansa hijau-gelap.
- **Tipografi:** h1 22/800, h2 17/700, h3 14/700; `.mono` tabular-nums untuk angka (antrian, Rupiah).

### 9.2 Komponen kunci (paritas dengan desain)
`card`, `btn` (primary/ghost/soft/danger, **min-height 44px**), `badge`/pill (teal/green/amber/red/sky/violet/gray), `dot` + `pulse` (antrian aktif), input/select/textarea (focus ring teal, min-h 44px), `avatar`, `seg` (segmented control), `tbl` (tabel hover), `skel` (skeleton), `fade-in`, `toast`.

### 9.3 Layout responsif
- **Mobile-first.** Peran staf: **bottom nav** (4 item utama + "Lainnya"). Tablet/desktop: **sidebar**. Header memuat slot **branch switcher** (tersembunyi fase 1) + role switcher + toggle tema.
- Target sentuh ≥ 44px; kontras AA; label jelas; pesan error solutif (Bahasa Indonesia).

---

## 10. Autentikasi & Otorisasi

- **Login** email + password → verifikasi argon2.
- **JWT**: access token (≈15 menit, klaim: `sub`, `role`, `branch_id`) + refresh token (≈7–30 hari, rotating). Disimpan di **httpOnly + Secure + SameSite=Lax cookie**. Refresh token di-hash di `sessions`.
- **Middleware Next.js** memvalidasi access token & menyuntik konteks (`userId`, `role`, `branchId`) ke request.
- **Otorisasi server-side** di tiap Route Handler: `requireRole(['dokter'])`. UI menyembunyikan menu, tetapi keputusan akhir di server.
- Rotasi & revokasi sesi (logout, ganti password → revoke semua sesi).
- Rate limit pada login & endpoint integrasi.

---

## 11. Desain API Internal

### 11.1 Konvensi
- REST di `app/api/**` (Route Handlers). Resource jamak: `/api/patients`, `/api/encounters`, `/api/prescriptions`, `/api/bills`, `/api/drugs`, `/api/reports/*`.
- Validasi body/query dengan **Zod**; parse → 422 bila gagal.
- **Format respons error seragam** (mirip FHIR OperationOutcome, disederhanakan):
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "NIK harus 16 digit", "details": [] } }
```
- **Idempotency** via header `Idempotency-Key` untuk mutasi sensitif (dispensing, pembayaran, submisi integrasi).
- Semua list endpoint mendukung `?q=`, paginasi (`?page=&limit=`), dan otomatis scoped `branch_id`.

### 11.2 Contoh endpoint
```
POST /api/encounters            { patientId, doctorId, complaint }            → buat antrian
PATCH /api/encounters/:id/status { status }                                   → panggil/ubah
POST /api/encounters/:id/vitals  { td, nadi, suhu, rr, spo2, bb, tb }
POST /api/encounters/:id/rme     { soap, diagnoses[], procedures[] }          → tutup → enqueue SATUSEHAT
POST /api/prescriptions/:id/dispense                                          → potong stok (txn)
POST /api/bills/:id/pay          { method }                                   → lunas + nota
GET  /api/reports/finance?from=&to=                                           → ekspor
```

---

## 12. Integrasi Eksternal (API-call ready)

Semua integrasi: kredensial dari **Pengaturan** (terenkripsi), pemanggilan **di server**, submisi **asinkron via outbox**, **retry + backoff**, dan **audit log** tiap submisi. Sediakan **mode sandbox/dev** vs **produksi** lewat env.

### 12.1 SATUSEHAT (HL7 FHIR R4)
- **Auth:** OAuth 2.0 **Client Credentials**. Tukar `client_id` + `client_secret` (dari Developer Portal SATUSEHAT) → `access_token`. **Cache token & refresh sebelum kedaluwarsa** (jangan minta token per-request).
- **Base FHIR (dev):** `https://api-satusehat-dev.dto.kemkes.go.id/fhir-r4/v1` (produksi: domain prod sesuai portal).
- **Resource yang dipakai fase 1:** `Organization` (klinik), `Location`, `Practitioner` (dokter, by SATUSEHAT ID), `Patient` (resolusi **IHS number** by NIK), `Encounter`, `Condition` (dx ICD-10), `Observation` (vital sign), `MedicationRequest` (resep).
- **Alur submisi (per kunjungan, asinkron):**
  1. Resolusi/`ensure` IHS pasien (by NIK) → simpan `patients.satusehat_ihs_id`.
  2. `POST Encounter` (subject=Patient, participant=Practitioner, location) → simpan id.
  3. `POST Condition` untuk tiap diagnosa (encounter ref + ICD-10).
  4. `POST Observation` untuk vital sign (LOINC/standar SATUSEHAT).
  5. `POST MedicationRequest` untuk resep (KFA code bila ada).
  6. Update `encounters.sync_status` → `tersinkron` / `gagal` (+pesan) → tampil sebagai badge di RME.
- **Best practice wajib:** token refresh di integration layer, retry dengan backoff terhadap rate limit/downtime, **audit logging tiap submisi** untuk pelaporan kepatuhan.

Contoh token & POST Encounter → lihat §19.1.

### 12.2 BPJS Kesehatan — PCare (FKTP)
> Gunakan **`@ssecd/jkn`** agar tidak hand-roll signature/dekripsi. Mekanisme di bawah untuk pemahaman & verifikasi.

- **Kredensial:** `cons_id`, `cons_secret`, `user_key` (PCare), `username`/`password` PCare, `kd_aplikasi = 095`.
- **Base (dev):** `https://dvlp.bpjs-kesehatan.go.id:9081/pcare-rest-v3.0` · (prod): `https://new-api.bpjs-kesehatan.go.id/pcare-rest-v3.0`.
- **Header tiap request:**
  - `X-cons-id`: cons_id
  - `X-timestamp`: epoch detik UTC `floor(Date.now()/1000)` (UTC, selalu fresh)
  - `X-signature`: `base64( HMAC_SHA256( message = "${cons_id}&${timestamp}", key = cons_secret ) )`
  - `X-authorization`: `Basic ` + `base64("${username}:${password}:${kd_aplikasi}")`
  - `user_key`: user_key PCare
- **Respons terenkripsi:** body harus **didekripsi** (kunci diturunkan dari `cons_id + cons_secret + timestamp`, AES-256-CBC) lalu **dekompresi LZ-String** → JSON. *(Verifikasi detail terkini di BPJS Trustmark; `@ssecd/jkn` sudah menangani ini.)*
- **Use case fase 1:** validasi kepesertaan (cek No. BPJS/NIK), referensi diagnosa, pencatatan kunjungan PCare (opsional). Tampilkan hasil di Pendaftaran & Kasir.
- **Antrean BPJS (opsional):** integrasi "Antrean RS/FKTP" untuk sinkron antrean Mobile JKN — disiapkan, aktif di fase pasien.

Contoh signature → lihat §19.2.

### 12.3 Notifikasi WhatsApp / Email
- Pengingat janji temu & nota digital. Asinkron via outbox. Provider WhatsApp Business API (template approved) + email transaksional. Opt-in per pasien.

---

## 13. Observability: Logging, Error, Audit

- **Pino** untuk structured logging (JSON). **Redaksi PII** (NIK, No. BPJS, nama, alamat, token) di config redact. Korelasi `requestId` per request.
- **Sentry** untuk error client & server; aktifkan tracing pada Route Handlers integrasi; unggah source maps di CI. **Scrub PII** sebelum kirim ke Sentry.
- **Audit log** aplikatif (`audit_logs`): siapa mengakses/mengubah RME, dispensing, pembayaran, submisi integrasi — wajib untuk kepatuhan RME.

---

## 14. Keamanan & Kepatuhan

- **Permenkes 24/2022:** RME wajib & interoperabel SATUSEHAT. Penyelenggaraan RME mencakup registrasi → pengisian informasi klinis → penyimpanan → penjaminan mutu → transfer isi RME; sistem harus mendukung siklus ini dan menjaga keamanan & kerahasiaan.
- **Pelindungan data pribadi (UU PDP):** data kesehatan = data spesifik. Enkripsi **at rest** (kolom sensitif & `integration_credentials` via AES-256, kunci dari KMS/secret manager) dan **in transit** (TLS). Akses berbasis peran + audit.
- **Residensi data:** simpan data RME di infrastruktur di Indonesia (pertimbangkan self-host / cloud region ID) — pengaruhi keputusan deployment (hindari asumsi region asing).
- **Hardening:** httpOnly cookies, CSRF protection pada mutasi, rate limiting, input sanitization, prinsip least-privilege DB, rotasi secret. Jangan pernah taruh PII di query string/URL.
- **Backup & retensi:** backup terenkripsi terjadwal; kebijakan retensi RME sesuai regulasi.

---

## 15. Kualitas: Testing, CI/CD, Performa

- **Testing:** Vitest (unit service/utils, generator signature BPJS, mapper FHIR), integration (Route Handlers + DB test container), **Playwright** untuk alur inti (login→daftar→antrian→RME→farmasi→kasir).
- **CI (GitHub Actions):** install → lint → typecheck → unit/integration → build → (preview) migrate. Block merge bila gagal.
- **Migrasi:** drizzle-kit, versioned, dijalankan di pipeline deploy; seed data referensi (ICD-10, tarif, obat contoh, 1 branch + akun tiap peran).
- **Performa:** RSC + caching untuk read berat; index DB pada kolom pencarian (`patients.nik`, `rm_number`, `phone`, `encounters.status`, `branch_id`); paginasi semua list; debounce pencarian; polling antrian hemat.

---

## 16. Struktur Proyek

```
sim-klinik/
├─ app/
│  ├─ (auth)/login/
│  ├─ (app)/dashboard/  pendaftaran/  antrian/  jadwal/  rme/  farmasi/  kasir/  laporan/  pengaturan/
│  └─ api/
│     ├─ auth/        patients/   encounters/  prescriptions/  bills/  drugs/  reports/
│     └─ integrations/ satusehat/  bpjs/  whatsapp/   webhooks/
├─ components/        # shadcn/ui + komponen domain (QueueBoard, SoapForm, BillSummary, ...)
├─ lib/
│  ├─ auth/           # jwt (jose), session, rbac
│  ├─ db/             # drizzle client
│  ├─ integrations/
│  │  ├─ satusehat/   # client, token cache, fhir mappers
│  │  ├─ bpjs/        # wrapper @ssecd/jkn / signature, decrypt
│  │  └─ whatsapp/
│  ├─ queue/          # bullmq, outbox processor
│  ├─ logger.ts       # pino
│  └─ env.ts          # zod env parsing
├─ drizzle/           # schema/, migrations/
├─ styles/            # tokens.css → tailwind theme
├─ tests/             # vitest + playwright
├─ docker-compose.yml # postgres + redis
└─ ...
```

---

## 17. Environment Variables

```bash
# App
NODE_ENV=production
APP_URL=https://...
TZ=Asia/Jakarta

# Database / cache
DATABASE_URL=postgres://user:pass@host:5432/simklinik
REDIS_URL=redis://host:6379

# Auth
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
DATA_ENCRYPTION_KEY=...        # AES-256 untuk kolom sensitif/kredensial

# Observability
SENTRY_DSN=...
LOG_LEVEL=info

# SATUSEHAT
SATUSEHAT_BASE_URL=https://api-satusehat-dev.dto.kemkes.go.id
SATUSEHAT_AUTH_URL=https://api-satusehat-dev.dto.kemkes.go.id/oauth2/v1/accesstoken
SATUSEHAT_CLIENT_ID=...
SATUSEHAT_CLIENT_SECRET=...
SATUSEHAT_ORG_ID=...

# BPJS PCare
BPJS_PCARE_BASE_URL=https://dvlp.bpjs-kesehatan.go.id:9081
BPJS_PCARE_SERVICE=pcare-rest-v3.0
BPJS_CONS_ID=...
BPJS_CONS_SECRET=...
BPJS_PCARE_USER_KEY=...
BPJS_PCARE_USERNAME=...
BPJS_PCARE_PASSWORD=...
BPJS_PCARE_APP_CODE=095

# WhatsApp / Email (opsional)
WA_PROVIDER_TOKEN=...
EMAIL_API_KEY=...
```
> Validasi semua env di `lib/env.ts` (Zod). Gagal-cepat saat ada yang kosong.

---

## 18. Roadmap & Fase

- **Fase 1 (PRD ini):** sisi staf penuh — auth/RBAC, dashboard, pendaftaran, antrian, jadwal, RME, farmasi, kasir, laporan, pengaturan; submisi SATUSEHAT asinkron + status; cek peserta BPJS PCare; notifikasi WA dasar.
- **Fase 2:** Portal/aplikasi **pasien** (antrian online, status, riwayat) → aktifkan `queue_source='online'` + Antrean BPJS/Mobile JKN.
- **Fase 3:** **Multi-cabang** aktif (branch switcher, laporan lintas cabang, transfer stok), peran tambahan, dashboard manajemen lanjutan.
- **Fase 4:** Spesialisasi tambahan (gigi/lab), klaim lanjutan, telemedisin.

---

## 19. Lampiran: Contoh Kontrak Integrasi

> Contoh untuk mempercepat implementasi. Verifikasi detail terbaru terhadap dokumentasi resmi SATUSEHAT & BPJS Trustmark saat onboarding kredensial.

### 19.1 SATUSEHAT — token + POST Encounter (TypeScript, server)
```ts
// lib/integrations/satusehat/client.ts
let cached: { token: string; exp: number } | null = null;

export async function getToken(): Promise<string> {
  if (cached && Date.now() < cached.exp - 60_000) return cached.token;
  const res = await fetch(`${process.env.SATUSEHAT_AUTH_URL}?grant_type=client_credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.SATUSEHAT_CLIENT_ID!,
      client_secret: process.env.SATUSEHAT_CLIENT_SECRET!,
    }),
  });
  const data = await res.json(); // { access_token, expires_in, ... }
  cached = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

export async function postEncounter(enc: fhir4.Encounter) {
  const token = await getToken();
  const res = await fetch(`${process.env.SATUSEHAT_BASE_URL}/fhir-r4/v1/Encounter`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(enc),
  });
  if (!res.ok) throw new Error(`SATUSEHAT Encounter failed: ${res.status}`);
  return res.json();
}
```
```ts
// contoh mapping ke FHIR Encounter (rawat jalan)
const encounter: fhir4.Encounter = {
  resourceType: 'Encounter',
  status: 'finished',
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
  subject: { reference: `Patient/${patient.satusehat_ihs_id}`, display: patient.name },
  participant: [{ individual: { reference: `Practitioner/${doctor.satusehat_practitioner_id}` } }],
  serviceProvider: { reference: `Organization/${process.env.SATUSEHAT_ORG_ID}` },
  period: { start: isoStart, end: isoEnd },
};
```

### 19.2 BPJS PCare — generate header signature (TypeScript, server)
```ts
// lib/integrations/bpjs/signature.ts
import crypto from 'node:crypto';

export function pcareHeaders() {
  const consId = process.env.BPJS_CONS_ID!;
  const secret = process.env.BPJS_CONS_SECRET!;
  const timestamp = Math.floor(Date.now() / 1000).toString(); // epoch detik UTC
  const signature = crypto.createHmac('sha256', secret)
    .update(`${consId}&${timestamp}`).digest('base64');
  const authz = Buffer.from(
    `${process.env.BPJS_PCARE_USERNAME}:${process.env.BPJS_PCARE_PASSWORD}:${process.env.BPJS_PCARE_APP_CODE}`
  ).toString('base64');
  return {
    'X-cons-id': consId,
    'X-timestamp': timestamp,
    'X-signature': signature,
    'X-authorization': `Basic ${authz}`,
    'user_key': process.env.BPJS_PCARE_USER_KEY!,
  };
}
// Respons terenkripsi → dekripsi (kunci dari consId+secret+timestamp, AES-256) lalu LZString.decompress.
// Disarankan pakai @ssecd/jkn yang sudah menangani signature + dekripsi otomatis.
```

---

### Catatan untuk coding agent
1. **Baca handoff bundle desain** (`SIM Klinik.html` + imports) sebelum coding; recreate UI pixel-perfect ke Tailwind/shadcn dengan token §9.
2. Bangun **skema Drizzle + migrasi + seed** (§8) lebih dulu, lalu auth/RBAC (§10), lalu modul mengikuti urutan prioritas §4, integrasi terakhir (§12) di belakang outbox.
3. Integrasi eksternal **tidak boleh memblok** pelayanan: selalu asinkron + status + retry.
4. Jika ada ambiguitas (kredensial, endpoint produksi, detail dekripsi BPJS), **konfirmasi** sebelum implementasi.
