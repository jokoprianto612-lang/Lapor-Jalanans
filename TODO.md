# TODO — Lapor Jalan (lanjutan)

Terakhir dikerjakan: 2026-10-12, commit `4fa431c` (pushed, remote = `4fa431c`).

## Cara jalanin (verified 2026-10-12)

```bash
cd C:\Users\asusv\lapor-jalanans-audit\frontend
npm run dev          # -> http://localhost:3000
```

- `.env.local` sudah ada (Neon cloud DB + JWT/LLM secrets). **Tidak di-commit** (gitignored).
- **Tidak butuh Postgres lokal / Docker.** DB = Neon cloud dari project lama.
- **Tidak butuh backend Fastify** — semua API ada di `frontend/src/app/api/v1/*`.
- Login admin: `admin@laporjalan.id` / lihat `C:\Users\asusv\lapor-jalan-admin-password.txt`
- Login test user: `test@laporjalan.id` / lihat `C:\Users\asusv\lapor-jalan-testuser-password.txt`

## Yang sudah selesai (semua verified)

| Commit | Isi |
|---|---|
| `f186d05` | Fix `analyzeImage()` balikin TraceSpan bukan analysis; script pakai env bukan kredensial hardcoded |
| `2ce4899` | Hapus literal `password123` dari README + backend tests |
| `4fa431c` | Fix 5 regresi security dari konversi Fastify→Next.js + `SECURITY.md` |

Password yang dulu publik (`admin12345`, `password123`) **sudah dirotasi**. Yang lama tidak valid.

## BELUM DIKERJAKAN — urutan prioritas

### 1. CSRF — keputusan belum diambil
`README.md` klaim "JWT + httpOnly cookie + CSRF", tapi
`frontend/src/app/api/v1/auth/csrf-token/route.ts` balikin `{ csrf_token: 'not-needed' }`
dan tidak ada enforcement. Probe: `POST /chat/sessions` pakai cookie tanpa CSRF → 201.

Pilihan:
- (a) Benerin klaim README jadi jujur ("CSRF tidak dipakai di deployment ini")
- (b) Implementasi CSRF double-submit beneran

Risiko nyata terbatas (httpOnly + SameSite=lax), tapi klaim dokumen salah.

### 2. Rate limit in-memory → shared store
Lockout login (`frontend/src/app/api/v1/auth/login/route.ts`) pakai `Map` in-memory.
Di Vercel serverless: per-instance, hilang saat cold start → bukan proteksi global.
Perlu Upstash Redis atau Vercel Firewall rate limiting.

### 3. DATABASE_URL pakai endpoint unpooled
Host sekarang: `ep-red-dream-b564375q.c-7.us-east-2.aws.neon.tech` (tanpa `-pooler`).
Docs Neon: pooled (`-pooler`) untuk app runtime, unpooled untuk Prisma CLI.
Untuk Next.js serverless lebih tepat yang pooled. Ambil dari Neon Console → Connect → Pooled.

### 4. Verifikasi deploy Vercel
Belum pernah diverifikasi jalan di Vercel. Perlu:
- Set env vars di Vercel dashboard (DATABASE_URL, JWT_SECRET, SESSION_SECRET, LLM_*)
- Cek cookie `Secure` aktif di production
- Cek security headers aktif di production

### 5. `E57P01` di log — BUKAN BUG, jangan dikejar
Neon free-tier scale-to-zero (suspend setelah 5 menit idle). Free plan tidak bisa
mematikannya (docs Neon). Prisma reconnect otomatis. Cuma noise di log.

## File bantu

- `SECURITY.md` — semua temuan security + bukti probe + sisa risiko
- `frontend/test-admin.js` — 7 check admin (butuh `ADMIN_EMAIL`/`ADMIN_PASSWORD` env)
- `frontend/test-api.js` — 12 check API (butuh `TEST_EMAIL`/`TEST_PASSWORD` env)
- `backend/test/smoke.test.ts` — 8 check, tidak butuh DB

Contoh jalanin test:
```bash
cd frontend
ADMIN_EMAIL=admin@laporjalan.id ADMIN_PASSWORD=<pw> node test-admin.js
TEST_EMAIL=test@laporjalan.id TEST_PASSWORD=<pw> node test-api.js
```
