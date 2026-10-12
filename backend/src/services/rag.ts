// RAG Service - Knowledge Base Query
// TF-IDF based keyword search for road damage reporting knowledge


import { prisma } from '../lib/db.js';

// ─────────────────────────────────────────────
// Knowledge Base Documents (seeded at startup)
// ─────────────────────────────────────────────

interface KBDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  vector?: number[]; // TF-IDF vector
}

const KNOWLEDGE_BASE: KBDocument[] = [
  {
    id: 'kb-1',
    title: 'Prosedur Laporan Kerusakan Jalan ke RT/RW',
    content: `Untuk melaporkan kerusakan jalan di lingkungan RT/RW:
1. Foto kerusakan dengan jelas (dekat dan jauh)
2. Catat lokasi detail (nama jalan, RT/RW, kelurahan)
3. Hubungi Ketua RT setempat via WhatsApp/telepon
4. Kirim foto dan lokasi ke Ketua RT
5. Ketua RT akan mengajukan ke RW/Kelurahan
6. Dapatkan nomor tracking dari RT
Waktu tanggapan: 1-3 hari kerja untuk kerusakan ringan`,
    category: 'PROSEDUR',
    tags: ['rt', 'rw', 'prosedur', 'lapor', 'kelurahan']
  },
  {
    id: 'kb-2',
    title: 'Prosedur Laporan ke Dinas Pekerjaan Umum (PU)',
    content: `Untuk kerusakan jalan provinsi/nasional atau skala besar:
1. Kumpulkan bukti: foto, video, koordinat GPS
2. Akses website Dinas PU provinsi/kabupaten
3. Isi formulir pengaduan online (biasanya di menu "Pengaduan Masyarakat")
4. Lampirkan bukti foto/video
5. Dapatkan nomor registrasi pengaduan
6. Pantau status via website/telepon
Waktu tanggapan: 7-14 hari kerja tergantung prioritas`,
    category: 'PROSEDUR',
    tags: ['dinas', 'pu', 'pekerjaan umum', 'provinsi', 'nasional', 'online']
  },
  {
    id: 'kb-3',
    title: 'Jenis-Jenis Kerusakan Jalan dan Penanganannya',
    content: `JENIS KERUSAKAN JALAN:
1. LUBANG (POTHOLE) - Lubang pada permukaan aspal/beton
   - Ringan: < 15cm diameter, < 3cm dalam
   - Sedang: 15-30cm diameter, 3-5cm dalam  
   - Berat: > 30cm diameter, > 5cm dalam
   - Penanganan: Patch repair (ringan), Mill & overlay (berat)

2. RETAK (CRACK) - Retakan pada permukaan
   - Retak buaya (alligator cracking): indikasi kegagalan struktural
   - Retak longitudinal/transverse: retak memanjang/melintang
   - Penanganan: Crack sealing, overlay

3. LONGSOR (SUBSIDENCE) - Penurunan tanah di bawah jalan
   - Bahaya tinggi, butuh penanganan darurat
   - Penanganan: Stabilisasi tanah, rekonstruksi

4. DRAINASE (DRAINAGE) - Saluran air tersumbat/bocor
   - Menyebabkan banjir dan kerusakan jalan cepat
   - Penanganan: Pembersihan, perbaikan saluran

5. RAMBU/LAMPU (SIGN/LIGHTING) - Rambu rusak/lampu mati
   - Bahaya keamanan berkendara malam hari
   - Penanganan: Ganti rambu, perbaiki lampu`,
    category: 'TEKNIS',
    tags: ['jenis', 'kerusakan', 'lubang', 'retak', 'longsor', 'drainase', 'rambu', 'lampu', 'penanganan']
  },
  {
    id: 'kb-4',
    title: 'Instansi Bertanggung Jawab Berdasarkan Jenis Jalan',
    content: `PEMBAGIAN WEWENANG JALAN:
1. JALAN NASIONAL → Kementerian PU / Balai Pelaksana Jalan Nasional (BPJN)
2. JALAN PROVINSI → Dinas PU Provinsi / Dinas Bina Marga Provinsi
3. JALAN KABUPATEN/KOTA → Dinas PU Kabupaten/Kota / Dinas Bina Marga
4. JALAN DESA/KELURAHAN → Pemerintah Desa/Kelurahan (via RT/RW)
5. JALAN TOL → PT Jasa Marga / BUMD Tol terkait
6. JALAN DI KAWASAN INDUSTRI → Pengelola Kawasan Industri
7. JALAN DI PERUMAHAN → Pengelola Perumahan / RT/RW

KHUSUS:
- Lampu jalan (PJU) → PLN / Dinas PU (tergantung wilayah)
- Drainase → Dinas PU / Dinas Cipta Karya
- Rambu lalu lintas → Dinas Perhubungan / Polisi (Ditlantas)
- Jembatan → Dinas PU (struktur), Dinas Bina Marga`,
    category: 'WEWENANG',
    tags: ['instansi', 'wenewang', 'dinas', 'pu', 'bina marga', 'provinsi', 'kabupaten', 'desa', 'tol', 'pln', 'polisi', 'perhubungan']
  },
  {
    id: 'kb-5',
    title: 'Cara Mengukur Keparahan Kerusakan untuk Laporan',
    content: `PANDUAN PENGUKURAN UNTUK LAPORAN AKURAT:
1. UKURAN LUBANG:
   - Diameter: ukur bagian terlebar (cm)
   - Kedalaman: ukur dari permukaan ke dasar lubang (cm)
   - Contoh format: "Lubang 30x40 cm, dalam 8 cm"

2. UKURAN RETAK:
   - Panjang retak (meter)
   - Lebar retak (mm)
   - Pola: buaya/memanjang/melintang

3. LOKASI GPS:
   - Buka Google Maps → tahan titik → copy koordinat
   - Format: -6.123456, 106.789012 (lat, lng)

4. FOTO YANG DIBUTUHKAN:
   - Foto dekat (close-up) kerusakan + batu ukur/ID card untuk skala
   - Foto jauh (wide) menunjukkan konteks jalan
   - Foto papan nama jalan (jika ada)
   - Foto landmark dekat (toko, gedung, dll)

5. INFORMASI TAMBAHAN:
   - Waktu terjadi (perkiraan)
   - Apakah sudah menyebabkan kecelakaan
   - Volume lalu lintas (ramai/sepi)
   - Cuaca terkini (hujan/panas)`,
    category: 'PANDUAN',
    tags: ['ukur', 'keparahan', 'diameter', 'kedalaman', 'gps', 'foto', 'koordinat', 'skala']
  },
  {
    id: 'kb-6',
    title: 'Hak Warga dan Kewajiban Pemerintah dalam Perbaikan Jalan',
    content: `HAK WARGA (Berdasarkan UU No. 25/2009 Pelayanan Publik):
1. Hak mendapat pelayanan publik yang memuaskan
2. Hak mengajukan pengaduan/keberatan
3. Hak mendapat informasi status pengaduan
4. Hak mendapat ganti rugi jika kerugian akibat kelalaian

KEWAJIBAN PEMERINTAH (UU No. 22/2009 Lalu Lintas & Angkutan Jalan):
1. Menyediakan jalan yang aman dan layak pakai
2. Melakukan pemeliharaan rutin dan berkala
3. Menanggapi pengaduan dalam waktu wajar
4. Memberikan informasi transparan

WAKTU PELAYANAN STANDAR (Permen PU No. 22/2014):
- Kerusakan darurat (bahaya nyata): 24 jam
- Kerusakan berat: 7 hari kerja
- Kerusakan sedang: 14 hari kerja
- Kerusakan ringan: 30 hari kerja

JIKA MELEWATI BATAS WAKTU:
1. Ajukan keberatan ke atasan pejabat
2. Laporkan ke Ombudsman / BPKP
3. Gunakan media sosial resmi instansi
4. Ajukan ganti rugi via pengadilan (jika ada kerugian)`,
    category: 'HUKUM',
    tags: ['hak', 'kewajiban', 'uu', 'pelayanan', 'publik', 'ombudsman', 'bpkp', 'waktu', 'standar', 'ganti rugi']
  },
  {
    id: 'kb-7',
    title: 'Template Laporan Resmi Kerusakan Jalan',
    content: `TEMPLATE LAPORAN RESMI:
---
KEPADA YTH. [NAMA INSTANSI]
[ALAMAT INSTANSI]

PERIHAL: LAPORAN KERUSAKAN JALAN DI [NAMA JALAN, RT/RW, KELURAHAN]

Dengan hormat,
Saya yang bertanda tangan di bawah ini:
Nama: [NAMA LENGKAP]
NIK: [NIK]
Alamat: [ALAMAT LENGKAP]
No. HP/WA: [NOMOR WHATSAPP]
Email: [EMAIL]

Mengajukan laporan kerusakan jalan sebagai berikut:

1. LOKASI KERUSAKAN:
   - Nama Jalan: [NAMA JALAN]
   - RT/RW: [RT/RW]
   - Kelurahan/Desa: [KELURAHAN]
   - Kecamatan: [KECAMATAN]
   - Koordinat GPS: [LAT, LNG]
   - Landmark: [TEMPAT TERDEKAT]

2. JENIS & KEPARAHAN KERUSAKAN:
   - Jenis: [LUBANG/RETAK/LONGSOR/DRAINASE/RAMBU/LAMPU/LAINNYA]
   - Ukuran: [DIMENSI DETAIL]
   - Tingkat Keparahan: [RINGAN/SEDANG/BERAT/DARURAT]

3. KRONOLOGI:
   - Ditemukan sejak: [TANGGAL]
   - Sudah menyebabkan: [KECELAKAAN/TIDAK]

4. BUKTI PENDUKUNG:
   - Foto: [JUMLAH] lembar (terlampir)
   - Video: [YA/TIDAK]

5. PERMINTAAN:
   - Segera dilakukan perbaikan/pemeliharaan
   - Diberitahukan progres penanganan
   - Diberikan nomor tracking pelaporan

Demikian laporan ini dibuat dengan sebenar-benarnya.

[TEMPAT], [TANGGAL]
Yang membuat laporan,

[TTD]
[NAMA LENGKAP]`,
    category: 'TEMPLATE',
    tags: ['template', 'surat', 'resmi', 'format', 'laporan', 'nik', 'gps', 'bukti']
  }
];

// ─────────────────────────────────────────────
// TF-IDF Implementation
// ─────────────────────────────────────────────

// Simple tokenizer
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

// Build vocabulary
function buildVocabulary(docs: KBDocument[]): string[] {
  const vocab = new Set<string>();
  for (const doc of docs) {
    const tokens = tokenize(doc.title + ' ' + doc.content + ' ' + doc.tags.join(' '));
    for (const token of tokens) vocab.add(token);
  }
  return Array.from(vocab);
}

// Compute TF-IDF vectors
function computeTFIDF(docs: KBDocument[], vocab: string[]): number[][] {
  const N = docs.length;
  const docFreq = new Map<string, number>();
  
  // Compute document frequency
  for (const doc of docs) {
    const tokens = new Set(tokenize(doc.title + ' ' + doc.content + ' ' + doc.tags.join(' ')));
    for (const token of tokens) {
      docFreq.set(token, (docFreq.get(token) || 0) + 1);
    }
  }
  
  // Compute vectors
  const vectors: number[][] = [];
  for (const doc of docs) {
    const tokens = tokenize(doc.title + ' ' + doc.content + ' ' + doc.tags.join(' '));
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }
    
    const vector: number[] = [];
    for (const term of vocab) {
      const tfVal = tf.get(term) || 0;
      const df = docFreq.get(term) || 1;
      const idf = Math.log(N / df);
      vector.push(tfVal * idf);
    }
    vectors.push(vector);
  }
  
  return vectors;
}

// Cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

// ─────────────────────────────────────────────
// Initialize
// ─────────────────────────────────────────────

let vocab: string[] = [];
let docVectors: number[][] = [];
let initialized = false;

function initialize() {
  if (initialized) return;
  vocab = buildVocabulary(KNOWLEDGE_BASE);
  docVectors = computeTFIDF(KNOWLEDGE_BASE, vocab);
  initialized = true;
}

// ─────────────────────────────────────────────
// Query Functions
// ─────────────────────────────────────────────

/**
 * Query knowledge base
 */
export async function ragQuery(query: string, limit: number = 5): Promise<Array<{
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  score: number;
}>> {
  initialize();
  
  // Vectorize query
  const queryTokens = tokenize(query);
  const queryVector: number[] = [];
  
  for (const term of vocab) {
    const tf = queryTokens.filter(t => t === term).length;
    const df = docVectors.filter(v => v[vocab.indexOf(term)] > 0).length || 1;
    const idf = Math.log(KNOWLEDGE_BASE.length / df);
    queryVector.push(tf * idf);
  }
  
  // Score documents
  const scores = docVectors.map((vec, i) => ({
    doc: KNOWLEDGE_BASE[i],
    score: cosineSimilarity(queryVector, vec)
  }));
  
  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);
  
  // Return top results
  return scores
    .slice(0, limit)
    .filter(s => s.score > 0.01)
    .map(s => ({
      id: s.doc.id,
      title: s.doc.title,
      content: s.doc.content,
      category: s.doc.category,
      tags: s.doc.tags,
      score: s.score
    }));
}

/**
 * Get document by ID
 */
export function getDocument(id: string): KBDocument | undefined {
  return KNOWLEDGE_BASE.find(d => d.id === id);
}

/**
 * Get all documents by category
 */
export function getDocumentsByCategory(category: string): KBDocument[] {
  return KNOWLEDGE_BASE.filter(d => d.category === category);
}

/**
 * Get all categories
 */
export function getCategories(): string[] {
  return Array.from(new Set(KNOWLEDGE_BASE.map(d => d.category)));
}

/**
 * Add document to knowledge base (runtime)
 */
export function addDocument(doc: Omit<KBDocument, 'vector'>): KBDocument {
  const newDoc: KBDocument = { ...doc, id: `kb-${Date.now()}` };
  KNOWLEDGE_BASE.push(newDoc);
  
  // Recompute vectors
  vocab = buildVocabulary(KNOWLEDGE_BASE);
  docVectors = computeTFIDF(KNOWLEDGE_BASE, vocab);
  
  return newDoc;
}

/**
 * Search by tags
 */
export function searchByTags(tags: string[], limit: number = 10): KBDocument[] {
  return KNOWLEDGE_BASE
    .filter(doc => tags.some(tag => doc.tags.includes(tag)))
    .slice(0, limit);
}