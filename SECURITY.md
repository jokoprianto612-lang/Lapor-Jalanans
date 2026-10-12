# Security — Lapor Jalan (frontend / Vercel deployment)

Audit: 2026-10-12, terhadap commit `2ce4899`.
Metode: probe runtime terhadap dev server + pembacaan kode. Setiap klaim di
bawah ini punya bukti (status HTTP aktual atau `file:line`).

## Konteks penting: deployment mana yang kamu pakai

Repo ini punya **dua implementasi backend**:

| | `backend/` (Fastify) | `frontend/src/app/api/` (Next.js) |
|---|---|---|
| Dipakai dev lokal | ❌ tidak | ✅ ya |
| Dipakai Vercel | ❌ tidak | ✅ ya |
| Re-check tokenVersion dari DB | ✅ (`middleware/auth.ts:38-56`) | ✅ (setelah fix) |
| Rate limit / lockout login | ✅ | ✅ (setelah fix, in-memory) |
| Security headers | ✅ `@fastify/helmet` | ✅ (setelah fix, `next.config.js`) |

Konversi Fastify → Next.js API routes **kehilangan layer middleware**. Semua
temuan di bawah adalah akibat dari kehilangan itu, dan sudah diperbaiki.

## Yang sudah diperbaiki (commit `f186d05`, `2ce4899`, + commit security ini)

### 1. Token revocation mati → FIXED
**Sebelum:** `frontend/src/lib/auth.ts` `verifyToken()` hanya memverifikasi
signature JWT dan mengembalikan `roles` dari isi token. Field `v`
(tokenVersion) **tidak pernah dibaca**.

**Bukti (probe sebelum fix):** token dengan `v=99999` → `GET /auth/me` = **200**.

**Dampak nyata:** `POST /auth/change-password` menaikkan `tokenVersion`, tapi
tidak ada yang membacanya → **ganti password tidak mencabut token lama**.
Token yang dicuri tetap valid 7 hari.

**Fix:** `verifyToken()` sekarang async, baca ulang user dari DB, tolak kalau
`dbUser.tokenVersion !== payload.v`.

### 2. Role dari JWT, bukan DB → FIXED
**Sebelum:** `roles: payload.roles || []` — diambil dari isi token.

**Bukti (probe sebelum fix):** token dengan `roles: ['ADMIN']` →
`GET /admin/dashboard` = **200**.

**Catatan kejujuran soal exploitability:** untuk memalsukan token perlu
`JWT_SECRET`. Jadi user biasa **tidak bisa** langsung menaikkan diri jadi admin.
Dampak nyata: kalau admin diturunkan jadi citizen, token lamanya tetap admin
sampai 7 hari. Kalau `JWT_SECRET` bocor → admin penuh.

**Fix:** `roles` selalu diambil dari baris DB (`[dbUser.role]`).

### 3. `/auth/refresh` selalu gagal → FIXED
**Sebelum:** route baca `(payload as any).v`, padahal `verifyToken()` tidak
pernah mengembalikan `v` → `dbUser.tokenVersion !== undefined` selalu true.

**Bukti (probe sebelum fix):** `POST /auth/refresh` dengan cookie valid =
**401 TOKEN_REVOKED**.

**Dampak:** token tidak pernah bisa di-refresh; interceptor 401 di frontend
langsung logout user.

### 4. Tidak ada brute-force protection → FIXED (dengan batasan)
**Sebelum:** 15 login gagal berturut-turut → semua **401**, nol 429.

**Fix:** lockout per-akun di `frontend/src/app/api/v1/auth/login/route.ts`
(5 gagal → kunci 15 menit, balas 429 + `Retry-After`).

**Bukti (probe sesudah fix):** attempt 1-5 = 401, attempt 6-8 = **429**.
Akun lain tetap bisa login (200) saat satu akun terkunci.

**⚠️ BATASAN — baca ini:**
State lockout disimpan **in-memory**, jadi di Vercel serverless:
- state-nya **per-instance** (tiap lambda punya Map sendiri)
- **hilang saat cold start**

Artinya ini menghambat burst pada satu instance, **bukan** jaminan global.
Penyerang yang mendistribusikan request ke banyak instance tetap bisa
brute-force. Untuk proteksi yang tahan multi-instance, perlu shared store
(Upstash Redis) atau Vercel Firewall rate limiting.

### 5. Tidak ada security headers → FIXED
**Sebelum:** `next.config.js` hanya set Cache-Control untuk `/sw.js` dan
`/manifest.json`. Probe menunjukkan 6 header hilang semua.

**Fix:** `next.config.js` sekarang set CSP, X-Frame-Options, X-Content-Type-Options,
Referrer-Policy, Permissions-Policy, Strict-Transport-Security, X-DNS-Prefetch-Control.

**Bukti (sesudah fix):** semua header muncul di response. UI diverifikasi utuh
di browser (0 JS error, 0 CSP violation, style + script render normal).

### 6. Klaim CSRF di dokumentasi tidak sesuai → BELUM DIPERBAIKI
`README.md` mengklaim "Auth: JWT + httpOnly cookie + CSRF", tapi
`frontend/src/app/api/v1/auth/csrf-token/route.ts` mengembalikan
`{ csrf_token: 'not-needed' }` dan tidak ada enforcement.

**Bukti:** `POST /chat/sessions` dengan cookie auth tanpa token CSRF = **201**.

**Risiko nyata: terbatas**, karena cookie `httpOnly` + `SameSite=lax`
(`lax` menahan POST cross-site). Tapi klaim dokumentasinya salah.

**Opsi:** (a) perbaiki klaim README, atau (b) implementasi CSRF
double-submit. Belum dikerjakan — menunggu keputusan.

## Yang BUKAN temuan (jangan di-inflate)

- Verifikasi signature JWT **jalan benar**: signature salah → 401, expired → 401.
- Cookie `Secure` tidak ada di dev — **normal** (`secure: NODE_ENV === 'production'`).
  Di Vercel harusnya aktif; perlu diverifikasi di deploy.
- `E57P01` di log dev = Neon free-tier scale-to-zero. **Bukan bug aplikasi.**
  Free plan tidak bisa mematikannya (docs Neon). Prisma reconnect otomatis.

## Sisa risiko / belum diverifikasi

1. **CSRF** — lihat #6 di atas.
2. **Rate limit in-memory** — lihat batasan di #4.
3. **Endpoint `-pooler`** — `DATABASE_URL` memakai endpoint unpooled
   (`ep-...c-7.us-east-2.aws.neon.tech`, tanpa `-pooler`). Untuk Next.js
   serverless, endpoint pooled lebih tepat (lihat docs Neon). Belum diubah.
4. **Lockout per-akun bisa jadi DoS** — penyerang yang tahu email admin bisa
   sengaja mengunci akun itu 15 menit. Ini trade-off umum; alternatifnya
   rate-limit per-IP + CAPTCHA.
