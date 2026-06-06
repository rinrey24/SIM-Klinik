# SIM Klinik

Sistem Informasi Manajemen Klinik — fase 1 (fondasi + modul Dashboard & Pendaftaran).

Stack: **Next.js 15 (App Router) · TypeScript · Tailwind · Drizzle ORM · PostgreSQL · jose (JWT) · argon2 · TanStack Query**. Desain di-recreate dari handoff bundle (`tokens.css` → Tailwind theme + komponen utility).

## Quick start

Prasyarat: **Node 20+**, **pnpm 9+**, **Docker Desktop**.

```bash
# 1. Install deps
pnpm install

# 2. Start Postgres + Redis
docker compose up -d

# 3. Siapkan env
cp .env.example .env
# (lalu ganti JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, DATA_ENCRYPTION_KEY)

# 4. Generate & jalankan migrasi
pnpm db:generate
pnpm db:migrate

# 5. Seed (1 branch + 6 akun staf + ICD-10 + tarif + obat + pasien contoh)
pnpm db:seed

# 6. Jalankan dev server
pnpm dev
```

Buka `http://localhost:3000`. Login dengan salah satu akun seed (password: **rahasia123**):

| Peran | Email |
|---|---|
| Admin | `admin@kliniksehatbersama.id` |
| Pendaftaran | `pendaftaran@kliniksehatbersama.id` |
| Dokter | `dr.andini@kliniksehatbersama.id` |
| Perawat | `perawat.dewi@kliniksehatbersama.id` |
| Apoteker | `apt.rangga@kliniksehatbersama.id` |
| Kasir | `kasir@kliniksehatbersama.id` |

## Yang sudah jalan di fase 1

- ✅ **Auth & RBAC** — login JWT (httpOnly cookie), middleware proteksi route, server-side role guard di setiap page & API.
- ✅ **Design system** — token CSS & komponen (card/btn/badge/seg/avatar/modal/empty/toast) sesuai handoff, dark mode via `data-theme`.
- ✅ **Shell** — sidebar desktop + bottom nav mobile, navigasi per peran sesuai PRD §3.
- ✅ **Login** — pixel-parity dengan `screen-login.jsx` (brand panel + role chips + form).
- ✅ **Dashboard** — KPI live dari DB (pasien hari ini, antrian aktif, stok menipis), tren kunjungan, panel stok menipis.
- ✅ **Pendaftaran** — pencarian server-side (NIK/RM/nama/HP, debounced via TanStack Query), modal pasien baru dengan validasi, aksi *Masukkan ke Antrian* yang membuat `encounter` + nomor antrian otomatis `A-XXX` per hari.
- ✅ **Skema DB lengkap** sesuai PRD §8 — semua tabel transaksional siap (encounters, vital_signs, medical_records, prescriptions, drugs, stock_movements, bills, outbox_jobs, audit_logs, integration_credentials, dll) dengan `branch_id` multi-tenant ready.
- ✅ **API internal** — `/api/auth/{login,logout}`, `/api/patients`, `/api/encounters`, `/api/doctors`, dengan validasi Zod + format error seragam ala FHIR OperationOutcome.

## Yang menyusul (fase berikut)

Modul **Antrian, Jadwal, RME, Farmasi, Kasir, Laporan, Pengaturan** sudah punya halaman placeholder (proteksi peran sudah diterapkan), tinggal implementasi UI + endpoint. Integrasi **SATUSEHAT FHIR**, **BPJS PCare**, **WhatsApp** lewat outbox + worker BullMQ menyusul setelah modul inti selesai.

## Struktur proyek

```
app/
  (app)/             # area terproteksi (layout = AppShell + auth guard)
    dashboard/  pendaftaran/  antrian/  ...
  api/               # Route Handlers REST
    auth/{login,logout}/  patients/  encounters/  doctors/
  login/             # halaman login publik
components/
  shell/             # AppShell (sidebar + bottom nav)
  ui/                # primitives recreated dari handoff
lib/
  auth/              # jwt (jose), session, rbac
  db/                # drizzle client
  env.ts logger.ts utils.ts api.ts
drizzle/
  schema/            # skema lengkap PRD §8
  migrations/        # output drizzle-kit
  migrate.ts seed.ts
```

## Catatan teknis

- **Server actions OFF** — semua mutasi lewat Route Handlers REST + Zod, sesuai PRD §11.
- **Idempotency** — header `Idempotency-Key` akan ditambahkan saat implementasi modul kasir & integrasi.
- **Outbox** — tabel `outbox_jobs` sudah ada; worker BullMQ menyusul.
- **Multi-branch** — semua tabel transaksional sudah punya `branch_id`; sesi membawa `branchId` dari JWT.
- **Audit log** — `audit_logs` ditulis pada login, create patient, create encounter; akan diperluas ke modul lain.

## Troubleshooting

- **`pnpm db:migrate` gagal** — pastikan `docker compose up -d` jalan, dan `DATABASE_URL` di `.env` benar.
- **Login redirect loop** — pastikan `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` minimal 32 karakter.
- **`argon2` install gagal di Windows** — butuh build tools. Alternatif: install `node-gyp` prerequisites via `npm i -g windows-build-tools` (sekali saja), atau ganti ke `bcrypt`/`bcryptjs` di `lib/auth/session.ts` dan `app/api/auth/login/route.ts`.
