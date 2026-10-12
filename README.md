# Lapor Jalan

Sistem Pelaporan Kerusakan Infrastruktur Jalan Berbasis AI dengan antarmuka chat conversational.

## Tampilan Project

### Halaman Login
- Dark theme dengan logo jalan aspal + marka kuning
- Form email/password dengan icon Lucide
- Link ke halaman register

### Halaman Register
- Form nama, email, telepon (opsional), password
- Validasi password minimal 8 karakter
- Konfirmasi password

### Halaman Chat (Utama)
- Header: tombol "Laporan Baru" + judul sesi + avatar user
- Area chat: bubble user (kanan) dan AI (kiri)
- Input bar: tombol kamera, lokasi, mikrofon + textarea + tombol kirim
- Preview gambar yang akan dikirim (max 5)
- Location bar koordinat yang dipilih

### Halaman Info
- Hero section dengan gradient dark
- Cara kerja 4 langkah
- Fitur unggulan (6 card)
- Jenis kerusakan yang terdeteksi
- Tabel instansi yang terhubung
- Alur status laporan
- Tech stack

### Halaman Tracking (Publik)
- Input kode tracking
- Status laporan real-time
- QR code untuk sharing

## Proses Penggunaan

### 1. Login / Register
```
1. Buka http://localhost:3000
2. Klik "Daftar" untuk buat akun baru, atau login dengan akun existing
3. Masukkan email dan password
4. Sistem mengirim JWT token + httpOnly cookie
```

### 2. Mulai Laporan
```
1. Klik "Laporan Baru" di header chat
2. Atau langsung ketik pesan di input bar
3. Sesi baru otomatis dibuat
```

### 3. Kirim Laporan
```
Opsi A - Teks saja:
  Ketik: "Ada lubang di Jalan Sudirman dekat Mall Plaza"

Opsi B - Foto saja:
  Klik ikon kamera → pilih foto → kirim

Opsi C - Foto + Teks:
  Upload foto + ketik deskripsi → kirim

Opsi D - Foto + Lokasi:
  Upload foto + klik ikon lokasi → pilih di peta → kirim
```

### 4. AI Memproses
```
1. Guardrails check (injection, PII, toxicity)
2. Vision API analisis foto (jika ada)
3. Authority routing by lokasi (jika ada)
4. LLM generate respons + tool calls
5. AI meminta konfirmasi detail ke user
```

### 5. Submit Laporan
```
1. AI menampilkan draft laporan
2. User konfirmasi
3. Laporan dibuat dengan kode tracking unik
4. Notifikasi dikirim ke user
5. Laporan diteruskan ke instansi berwenang
```

### 6. Tracking
```
1. Buka http://localhost:3000/track/[kode-tracking]
2. Lihat status real-time
3. Update via WebSocket
```

## AI Agent / Workflow

### Arsitektur Agent

```
User Message
    ↓
Guardrails (injection/PII/toxicity check)
    ↓
Vision API (jika ada foto)
    ↓
LLM (NVIDIA Nemotron) ← System Prompt + Tool Definitions
    ↓
Tool Calling Loop (max 4 steps)
    ↓
Final Response
```

### Tool Registry

| Tool | Status | Deskripsi |
|------|--------|-----------|
| `rag_query` | Aktif | Cari info di knowledge base (prosedur, regulasi) |
| `vision_analysis` | Aktif | Analisis foto kerusakan jalan |
| `authority_routing` | Aktif | Temukan instansi berwenang by lokasi |
| `create_report` | Aktif | Buat laporan resmi ke sistem |
| `send_notification` | Aktif | Kirim notif ke user & instansi |
| `list_reports` | Aktif | Lihat riwayat laporan user |

### Agent Loop

```
Step 1: LLM menerima prompt + tool definitions
Step 2: LLM memutuskan tool mana yang dipanggil
Step 3: Tool dieksekusi, hasil dikembalikan ke LLM
Step 4: LLM analisis hasil, panggil tool lanjut atau jawab
Step 5: Final response disimpan ke database
```

### LLM Configuration

```env
LLM_API_ENDPOINT=https://integrate.api.nvidia.com/v1
LLM_API_KEY=nvapi-xxx
LLM_MODEL=nvidia/nemotron-3-ultra-550b-a55b
LLM_TIMEOUT_MS=60000
```

### Vision API Configuration

```env
VISION_API_ENDPOINT=https://api.nvidia.com/vision/analyze
VISION_API_KEY=nvapi-xxx
```

## Hasil / Output

### Contoh Interaksi

**User:** "Halo, saya mau lapor lubang di jalan Sudirman"

**AI Agent:**
> Halo! Selamat datang di sistem Lapor Jalan. Saya siap membantu Anda melaporkan lubang di Jalan Sudirman.
>
> Untuk menentukan instansi yang bertanggung jawab, saya butuh informasi lokasi yang lebih spesifik:
>
> 1. Kota/Kabupaten mana lokasinya?
> 2. Alamat lengkap atau landmark terdekat?
> 3. Kalau bisa, koordinat GPS dari Google Maps?
>
> Atau kalau Anda punya foto lubangnya, silakan upload di sini.

**User:** [upload foto lubang]

**AI Agent:**
> [Analysis Card]
> - Jenis: Lubang (Pothole)
> - Keparahan: Berat
> - Keyakinan: 85%
> - Ukuran: ~40x35 cm
> - Kedalaman: ~8 cm
>
> Faktor Risiko:
> - Kedalaman >5cm berbahaya untuk motor
> - Berpotensi menyebabkan kecelakaan di malam hari
>
> Rekomendasi: Perbaikan mendadak (emergency patching) dalam 24-48 jam

**User:** "Lokasinya di Jakarta Selatan, Jl. Sudirman No. 10"

**AI Agent:**
> [Authority Card]
> - Dinas Pekerjaan Umum (Dinas PU)
> - Cakupan: Jalan provinsi/kabupaten
> - Kontak: 021-xxxx
>
> Laporan siap dikirim. Konfirmasi untuk submit?

**User:** "Ya, kirim"

**AI Agent:**
> Laporan berhasil dikirim!
> Kode Tracking: LJR-MV3SCSWS-C75F
> Status: SUBMITTED
>
> Anda bisa memantau perkembangan di:
> http://localhost:3000/track/LJR-MV3SCSWS-C75F

### Output Laporan

```json
{
  "trackingCode": "LJR-MV3SCSWS-C75F",
  "title": "Lubang di Jalan Sudirman",
  "damageType": "POTHOLE",
  "severity": "HIGH",
  "status": "SUBMITTED",
  "aiAnalysis": {
    "confidence": 0.85,
    "details": {
      "description": "Terdeteksi lubang dengan ukuran ~40x35 cm",
      "riskFactors": ["Kedalaman >5cm berbahaya untuk motor"],
      "recommendedAction": "Perbaikan mendadak dalam 24-48 jam"
    }
  },
  "authority": {
    "name": "Dinas Pekerjaan Umum",
    "type": "DINAS_PU"
  }
}
```

## API Endpoints

### Authentication
| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/api/v1/auth/register` | Register user baru |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/logout` | Logout |
| GET | `/api/v1/auth/me` | Data user current |
| PATCH | `/api/v1/auth/me` | Update profile |
| POST | `/api/v1/auth/change-password` | Ganti password |

### Chat (AI Agent)
| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/api/v1/chat/sessions` | Buat sesi baru |
| GET | `/api/v1/chat/sessions` | List sesi user |
| GET | `/api/v1/chat/sessions/:id` | Pesan dalam sesi |
| POST | `/api/v1/chat/sessions/:id/messages` | Kirim pesan ke AI |
| POST | `/api/v1/chat/analyze-image` | Analisis foto cepat |
| POST | `/api/v1/chat/sessions/:id/submit-report` | Submit laporan resmi |
| DELETE | `/api/v1/chat/sessions/:id` | Hapus sesi |

### Reports
| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/api/v1/reports` | Buat laporan (dengan AI analysis) |
| GET | `/api/v1/reports/my` | Laporan saya |
| GET | `/api/v1/reports/assigned` | Laporan yang diassign |
| GET | `/api/v1/reports/:id` | Detail laporan |
| GET | `/api/v1/reports/track/:code` | Tracking publik |
| PATCH | `/api/v1/reports/:id/status` | Update status |
| POST | `/api/v1/reports/:id/assign` | Assign ke staff |

### Authorities
| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/api/v1/authorities/nearby` | Instansi terdekat |
| GET | `/api/v1/authorities/:id` | Detail instansi |
| GET | `/api/v1/authorities/types` | Tipe instansi |

### Public (No Auth)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/v1/public/track/:code` | Tracking publik |
| GET | `/api/v1/public/info` | Info sistem |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend | Fastify 4, TypeScript, Prisma ORM |
| Database | PostgreSQL 16 |
| LLM | NVIDIA Nemotron (via NVIDIA NIM API) |
| Vision | NVIDIA Vision API |
| Auth | JWT + httpOnly cookie + CSRF |
| State | Zustand + persist |
| Maps | Leaflet + OpenStreetMap |
| PWA | Service Worker + Workbox |

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 16+ (atau Docker)

### Development

```bash
# 1. Clone & install
git clone https://github.com/jokoprianto612-lang/Lapor-Jalanans.git
cd Lapor-Jalanans

# 2. Setup environment
cp .env.example .env
# Edit .env dengan API keys Anda

# 3. Backend
cd backend
npm install
npx prisma generate
npx prisma migrate dev
ADMIN_EMAIL=admin@laporjalan.id ADMIN_PASSWORD='ganti-dengan-password-kuat' npx prisma db seed
npm run dev

# 4. Frontend (terminal baru)
cd frontend
npm install
npm run dev

# 5. Akses
# Frontend: http://localhost:3000
# Backend API: http://localhost:3001
# API Docs: http://localhost:3001/documentation
```

### Docker

```bash
docker-compose up -d
docker-compose exec backend npx prisma migrate deploy
docker-compose exec -e ADMIN_EMAIL=admin@laporjalan.id -e ADMIN_PASSWORD='ganti-dengan-password-kuat' backend npx prisma db seed
```

## Testing

```bash
# Backend unit tests
cd backend
npm run test

# Typecheck
npm run typecheck

# Frontend typecheck
cd frontend
npm run typecheck
```

## Environment Variables

| Variable | Required | Deskripsi |
|----------|----------|-----------|
| `JWT_SECRET` | Ya | Secret JWT (min 32 chars) |
| `SESSION_SECRET` | Ya | Secret session (min 32 chars) |
| `DATABASE_URL` | Ya | PostgreSQL connection string |
| `LLM_API_ENDPOINT` | Ya | NVIDIA NIM API endpoint |
| `LLM_API_KEY` | Ya | NVIDIA NIM API key |
| `LLM_MODEL` | Ya | Model ID (default: nvidia/nemotron-3-ultra-550b-a55b) |
| `LLM_TIMEOUT_MS` | Tidak | Timeout LLM (default: 60000) |
| `VISION_API_ENDPOINT` | Tidak | Vision API endpoint |
| `VISION_API_KEY` | Tidak | Vision API key |
| `FRONTEND_URL` | Tidak | URL frontend (default: http://localhost:3000) |
| `PORT` | Tidak | Port backend (default: 3001) |

## Guardrails

| Fitur | Status | Deskripsi |
|-------|--------|-----------|
| Prompt Injection Shield | Aktif | Deteksi & blok override instruksi |
| PII Redaction | Aktif | NIK, phone, email, NPWP, rekening |
| Toxicity Filter | Aktif | Filter bahasa kasar ID/EN |
| Output Sanitization | Aktif | Sanitasi output LLM |

## Known Limitations

- Vision API masih menggunakan rule-based fallback jika API key tidak ada
- Authority boundary belum integrate dengan GIS service (Nominatim)
- Agent tool-calling bergantung pada format teks (bukan OpenAI function calling)
- Belum ada Redis untuk caching & session storage
- Notification providers (WhatsApp/SMS/Email) perlu konfigurasi API key masing-masing

## License

MIT
