# Lapor Jalan - Dokumentasi Project

---

## 📱 Tampilan Project

### Frontend (Next.js 14 + TypeScript)
```
├── src/
│   ├── app/                    # App Router pages
│   │   ├── chat/page.tsx       # Halaman chat AI
│   │   ├── login/page.tsx      # Login
│   │   ├── register/page.tsx   # Register
│   │   ├── track/[code]/page.tsx  # Tracking laporan
│   │   └── layout.tsx          # Layout utama
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatInterface.tsx    # Main chat UI (line 130: kirim location:null)
│   │   │   ├── MessageBubble.tsx    # Bubble pesan + AnalysisCard
│   │   │   ├── AnalysisCard.tsx     # Card analisis AI (FIX: defensive details)
│   │   │   ├── AuthorityCard.tsx    # Card instansi
│   │   │   ├── LocationPicker.tsx   # Pilih lokasi di peta
│   │   │   ├── ImageUpload.tsx      # Upload foto
│   │   │   └── ReportPreview.tsx    # Preview laporan final
│   │   └── ui/                 # Komponen UI reusable
│   ├── hooks/                  # Custom hooks
│   ├── lib/api.ts              # Axios instance ke backend
│   ├── store/                  # Zustand stores
│   └── types/index.ts          # TypeScript interfaces
```

### Backend (Fastify + TypeScript + Prisma)
```
├── src/
│   ├── index.ts                # Entry point, plugins, routes
│   ├── routes/
│   │   ├── chat.ts             # Chat AI endpoint (FIX: location nullable)
│   │   ├── auth.ts             # Login/register
│   │   ├── reports.ts          # CRUD laporan
│   │   ├── authorities.ts      # Data instansi
│   │   └── public.ts           # Public endpoints
│   ├── services/
│   │   ├── agent.ts            # AI Agent (tools, steps)
│   │   ├── vision.ts           # Analisis gambar (AI + fallback)
│   │   ├── report.ts           # Create report + tracking
│   │   ├── authority.ts        # Cari instansi terdekat
│   │   ├── memory.ts           # User memory context
│   │   ├── guardrails.ts       # Input/output sanitization
│   │   └── notification.ts     # WhatsApp/Email/SMS
│   ├── middleware/auth.ts      # JWT authenticate
│   ├── lib/db.ts               # Prisma client
│   └── types/index.ts          # Shared types (AIVisionAnalysis, etc.)
```

---

## ⚙️ Proses Penggunaan

### 1. Setup Development
```bash
# Backend
cd backend
npm install
cp .env.example .env  # Isi DATABASE_URL, JWT_SECRET, dll
npx prisma migrate dev
npm run dev           # Port 3001

# Frontend (terminal terpisah)
cd frontend
npm install
npm run dev           # Port 3000
```

### 2. Flow Pelaporan User
```
User → ChatInterface → Kirim pesan/foto/lokasi
                    ↓
         POST /api/v1/chat/sessions/:id/messages
                    ↓
         Backend validate (Zod schema) ← FIX: location nullable
                    ↓
         Guardrails check input
                    ↓
         Simpan pesan user (DB)
                    ↓
         Jika ada foto → analyzeImage() (vision.ts)
                    ↓
         Jika ada lokasi → findNearestAuthorities()
                    ↓
         runAgent() → AI response + tool calls
                    ↓
         Guardrails check output
                    ↓
         Return: { message, aiAnalysis, authorities }
                    ↓
         Frontend render: MessageBubble → AnalysisCard
```

### 3. API Endpoints Utama
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/v1/auth/register` | Daftar user |
| POST | `/api/v1/auth/login` | Login → return JWT |
| POST | `/api/v1/chat/sessions` | Buat session chat baru |
| POST | `/api/v1/chat/sessions/:id/messages` | Kirim pesan ke AI |
| GET | `/api/v1/chat/sessions` | List session user |
| POST | `/api/v1/chat/analyze-image` | Analisis gambar tanpa session |
| POST | `/api/v1/reports` | Submit laporan formal |
| GET | `/api/v1/public/reports/:trackingCode` | Tracking publik |

---

## 🤖 AI Agent / Workflow

### Arsitektur Agent (services/agent.ts)
```
User Message
    ↓
┌─────────────────────────────────────┐
│         runAgent(userId, sessionId, message)         │
├─────────────────────────────────────┤
│ 1. Build memory context (user prefs, history)        │
│ 2. System prompt: "Kamu asisten Lapor Jalan..."      │
│ 3. Available tools:                                   │
│    - create_report      → buat laporan formal         │
│    - find_authorities   → cari instansi terdekat      │
│    - analyze_image      → vision analysis             │
│    - get_report_status  → cek status laporan          │
│ 4. Loop max 5 steps:                                  │
│    - LLM reasoning (Nemotron-3-Ultra via NVIDIA)      │
│    - Execute tool calls                               │
│    - Observe results                                  │
│ 5. Return final answer + metadata                     │
└─────────────────────────────────────┘
    ↓
Fallback: fallbackRAGQuery() jika agent error
```

### Vision Analysis (services/vision.ts)
```
analyzeImage(base64, location?)
    ↓
┌─────────────────────────────────────┐
│ 1. Cek VISION_API_KEY + ENDPOINT    │
│ 2. Ya → callVisionAPI() (NVIDIA NIM)│
│    - object_detection               │
│    - classification                 │
│    - segmentation                   │
│    - parseVisionResponse()          │
│ 3. Tidak/Error → ruleBasedAnalysis()│
│    - extractImageMetadata()         │
│    - simulateDamageDetection()      │
│    - matchDamagePattern()           │
│    - generateDescription/Risk/Rec   │
└─────────────────────────────────────┘
    ↓
Return AIVisionAnalysis:
{
  damageType: "POTHOLE" | "CRACK" | ...,
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  confidence: 0.0-1.0,
  details: {
    description: string,
    estimatedSize: string,
    estimatedDepth: string,
    riskFactors: string[],
    recommendedAction: string
  },
  detectedObjects: DetectedObject[]
}
```

### Guardrails (services/guardrails.ts)
```
Input:  guardInput(text)  → { allowed, sanitized, flags, reason }
Output: guardOutput(text) → { sanitized, flags }
Checks:
  - Prompt injection detection
  - PII (NIK, no HP, email, alamat lengkap)
  - Toxicity (profanity, hate speech)
  - Max length (4000 char)
```

---

## 📊 Hasil / Output

### 1. Fix Bug Zod Validation (Backend)
**File**: `backend/src/routes/chat.ts`  
**Commit**: `ff64a6b`
```diff
- location: z.object({...}).optional()
+ location: z.object({...}).nullable().optional()
```
**Test**: `location: null` ✓ | `location` omitted ✓ | `location: {lat, lng}` ✓

### 2. Fix AnalysisCard Crash (Frontend)
**File**: `frontend/src/components/chat/AnalysisCard.tsx`  
**Problem**: `TypeError: Cannot read properties of undefined (reading 'estimatedSize')`  
**Fix**: Defensive destructuring dengan fallback object
```tsx
const details = analysis.details ?? {
  description: 'Detail tidak tersedia',
  estimatedSize: '-',
  estimatedDepth: '-',
  riskFactors: [],
  recommendedAction: '-'
};
```
Semua akses `analysis.details.xxx` → `details.xxx`

### 3. Test Results
```
✅ Backend build: tsc OK
✅ Frontend build: next build OK (warnings only, no errors)
✅ API /chat/sessions/:id/messages dengan location:null → 200 OK
✅ API /chat/sessions/:id/messages tanpa location → 200 OK
✅ API /chat/sessions/:id/messages dengan location object → 200 OK + authorities
✅ AnalysisCard render tanpa crash saat details undefined
```

### 4. Current Status
| Component | Status |
|-----------|--------|
| Backend API | Running port 3001 |
| Frontend Next.js | Running port 3000 |
| Database (PostgreSQL) | Connected via Prisma |
| AI Vision | Fallback mode (no API key) |
| AI Agent | Nemotron-3-Ultra via NVIDIA |
| Auth (JWT) | Working |
| GitHub Push | Latest: ff64a6b |

---

## 🚀 Deploy Checklist
- [ ] Set production `.env` (JWT_SECRET 32+, DATABASE_URL prod)
- [ ] `npm run build` both frontend & backend
- [ ] `npx prisma migrate deploy` 
- [ ] Setup reverse proxy (nginx) + SSL
- [ ] Configure VISION_API_KEY untuk AI vision production
- [ ] Setup WhatsApp/Email notification credentials
- [ ] Enable rate limiting & monitoring