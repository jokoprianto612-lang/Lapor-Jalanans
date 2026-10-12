'use client';

import Link from 'next/link';
import { Button, Card, Badge } from '@/components/ui';
import {
  Shield, MessageCircle, MapPin, Zap, Bell, Smartphone,
  Eye, Loader2, CheckCircle, Globe, Layers, Camera,
  ArrowRight, Route, Building2, AlertTriangle
} from 'lucide-react';
import { clsx } from 'clsx';

const features = [
  {
    icon: MessageCircle,
    title: 'Chat Conversational',
    description: 'Lapor kerusakan jalan seperti chatting dengan teman. Kirim foto, lokasi, dan deskripsi dalam satu percakapan natural.',
    color: 'text-accent-500',
    bg: 'bg-accent-500/10',
  },
  {
    icon: Eye,
    title: 'AI Vision Analysis',
    description: 'AI menganalisis foto otomatis: mendeteksi jenis kerusakan (lubang, retak, longsor, dll), tingkat keparahan, ukuran, dan rekomendasi perbaikan.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: MapPin,
    title: 'Geo-routing Otomatis',
    description: 'Berdasarkan lokasi GPS dan jenis kerusakan, sistem otomatis menentukan instansi berwenang: RT, RW, Kelurahan, Kecamatan, Dinas PU, Bina Marga, PLN, PDAM, Polisi.',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  {
    icon: Bell,
    title: 'Notifikasi Real-time',
    description: 'Update status laporan dikirim via WhatsApp, Email, SMS, dan Push Notification. Dari SUBMITTED sampai RESOLVED.',
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
  },
  {
    icon: Shield,
    title: 'Enterprise Guardrails',
    description: 'Proteksi keamanan AI: prompt injection shield, PII redaction (NIK, phone, email), toxicity filtering, dan output sanitization.',
    color: 'text-sky-500',
    bg: 'bg-sky-500/10',
  },
  {
    icon: Smartphone,
    title: 'PWA (Progressive Web App)',
    description: 'Install seperti aplikasi native, bekerja offline (draft laporan tersimpan), background sync saat online, push notifications.',
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
  },
];

const damageTypes = [
  { value: 'POTHOLE', label: 'Lubang (Pothole)', icon: AlertTriangle, color: 'bg-red-500/10 text-red-500' },
  { value: 'CRACK', label: 'Retak (Crack)', icon: Route, color: 'bg-orange-500/10 text-orange-500' },
  { value: 'SUBSIDENCE', label: 'Longsor/Subsidence', icon: AlertTriangle, color: 'bg-red-600/10 text-red-600' },
  { value: 'DRAINAGE', label: 'Masalah Drainase', icon: MapPin, color: 'bg-blue-500/10 text-blue-500' },
  { value: 'SIGN_DAMAGE', label: 'Kerusakan Rambu', icon: AlertTriangle, color: 'bg-yellow-500/10 text-yellow-500' },
  { value: 'LIGHTING', label: 'Kerusakan Lampu Jalan', icon: Zap, color: 'bg-amber-500/10 text-amber-500' },
];

const authorities = [
  { type: 'RT', label: 'RT (Rukun Tetangga)', desc: 'Lingkungan langsung, radius ~1km', color: 'gray' },
  { type: 'RW', label: 'RW (Rukun Warga)', desc: 'Koordinasi beberapa RT, radius ~2km', color: 'gray' },
  { type: 'KELURAHAN', label: 'Kelurahan/Desa', desc: 'Pemerintah kelurahan, radius ~3km', color: 'primary' },
  { type: 'KECAMATAN', label: 'Kecamatan', desc: 'Pemerintah kecamatan, radius ~5km', color: 'primary' },
  { type: 'DINAS_PU', label: 'Dinas Pekerjaan Umum', desc: 'Jalan provinsi/kabupaten, radius ~50km', color: 'success' },
  { type: 'DINAS_BINA_MARGA', label: 'Dinas Bina Marga', desc: 'Khusus jalan & jembatan, radius ~50km', color: 'success' },
  { type: 'POLISI', label: 'Polisi (Ditlantas)', desc: 'Lalu lintas & keamanan jalan', color: 'danger' },
  { type: 'PLN', label: 'PLN', desc: 'Listrik & lampu jalan (PJU)', color: 'warning' },
  { type: 'PDAM', label: 'PDAM', desc: 'Air bersih & drainase', color: 'primary' },
];

const statusFlow = [
  { status: 'SUBMITTED', label: 'Dikirim', desc: 'Laporan masuk sistem', color: 'primary' },
  { status: 'ANALYZING', label: 'Dianalisis AI', desc: 'Vision AI memproses foto', color: 'primary' },
  { status: 'VERIFIED', label: 'Diverifikasi', desc: 'Admin memvalidasi laporan', color: 'success' },
  { status: 'ROUTED', label: 'Diteruskan', desc: 'Dikirim ke instansi berwenang', color: 'warning' },
  { status: 'IN_PROGRESS', label: 'Dikerjakan', desc: 'Tim lapangan menangani', color: 'warning' },
  { status: 'RESOLVED', label: 'Selesai', desc: 'Perbaikan selesai', color: 'success' },
];

export default function InfoPage() {
  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-secondary-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden road-gradient asphalt-texture">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="max-w-3xl">
            <Badge variant="primary" className="mb-6 bg-accent-500/10 text-accent-400 border-accent-500/20">
              <Zap className="w-3 h-3 mr-1" /> Sistem Pelaporan Cerdas Berbasis AI
            </Badge>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 text-white tracking-tight">
              Lapor Jalan
            </h1>
            <p className="text-lg sm:text-xl text-secondary-300 mb-8 leading-relaxed">
              Pelaporan kerusakan infrastruktur jalan otomatis:{' '}
              <span className="font-semibold text-white">Foto, AI Analisis, Langsung ke Instansi Berwenang</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/login">
                <Button size="lg" className="bg-accent-500 text-secondary-950 hover:bg-accent-400 w-full sm:w-auto px-8">
                  Mulai Lapor
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/info">
                <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 w-full sm:w-auto px-8">
                  Lihat Cara Kerja
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-white font-display">24/7</div>
                <div className="text-secondary-400 text-sm">Laporan Masuk</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white font-display">&lt;30s</div>
                <div className="text-secondary-400 text-sm">AI Response</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white font-display">10+</div>
                <div className="text-secondary-400 text-sm">Instansi Terhubung</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white font-display">95%+</div>
                <div className="text-secondary-400 text-sm">Akurasi Routing</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 lg:py-24 bg-white dark:bg-secondary-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-secondary-900 dark:text-white mb-4 tracking-tight">
              Cara Kerja
            </h2>
            <p className="text-lg text-secondary-600 dark:text-secondary-300 max-w-2xl mx-auto">
              Dari foto ke perbaikan, semua otomatis dengan AI
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: 1, icon: Camera, title: 'Foto & Kirim', desc: 'Ambil foto kerusakan jalan, tambah lokasi GPS, dan kirim via chat.' },
              { step: 2, icon: Eye, title: 'AI Menganalisis', desc: 'Vision AI mendeteksi jenis kerusakan, ukuran, keparahan, dan risiko.' },
              { step: 3, icon: Route, title: 'Routing Otomatis', desc: 'Sistem tentukan instansi berwenang terdekat berdasarkan lokasi.' },
              { step: 4, icon: CheckCircle, title: 'Tracking & Selesai', desc: 'Dapatkan kode tracking, update status real-time via WhatsApp.' },
            ].map((item) => (
              <Card key={item.step} className="relative overflow-hidden group hover:shadow-md transition-shadow">
                <div className="absolute top-0 left-0 w-full h-1 bg-accent-500" />
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-accent-500/10 flex items-center justify-center">
                      <item.icon className="w-5 h-5 text-accent-500" />
                    </div>
                    <span className="text-sm font-semibold text-accent-500">Langkah {item.step}</span>
                  </div>
                  <h3 className="text-lg font-bold text-secondary-900 dark:text-white mb-2">
                    {item.title}
                  </h3>
                  <p className="text-secondary-600 dark:text-secondary-300 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 lg:py-24 bg-secondary-50 dark:bg-secondary-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-secondary-900 dark:text-white mb-4 tracking-tight">
              Fitur Unggulan
            </h2>
            <p className="text-lg text-secondary-600 dark:text-secondary-300 max-w-2xl mx-auto">
              Dibangun untuk kecepatan, akurasi, dan transparansi
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <Card key={idx} className="group hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center mb-4', feature.bg)}>
                    <feature.icon className={clsx('w-6 h-6', feature.color)} />
                  </div>
                  <h3 className="text-lg font-bold text-secondary-900 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-secondary-600 dark:text-secondary-300 leading-relaxed text-sm">
                    {feature.description}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Damage Types */}
      <section className="py-16 lg:py-24 bg-white dark:bg-secondary-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-secondary-900 dark:text-white mb-4 tracking-tight">
              Jenis Kerusakan yang Terdeteksi
            </h2>
            <p className="text-lg text-secondary-600 dark:text-secondary-300 max-w-2xl mx-auto">
              AI vision mendeteksi 6 kategori kerusakan utama
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {damageTypes.map((type) => (
              <Card key={type.value} className="text-center p-5 hover:shadow-md transition-shadow">
                <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3', type.color)}>
                  <type.icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
                  {type.label}
                </span>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Authorities */}
      <section className="py-16 lg:py-24 bg-secondary-50 dark:bg-secondary-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-secondary-900 dark:text-white mb-4 tracking-tight">
              Instansi yang Terhubung
            </h2>
            <p className="text-lg text-secondary-600 dark:text-secondary-300 max-w-2xl mx-auto">
              Hirarki penanganan dari tingkat terkecil hingga nasional
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-secondary-200 dark:border-secondary-700">
                  <th className="pb-3 font-semibold text-secondary-900 dark:text-white">Instansi</th>
                  <th className="pb-3 font-semibold text-secondary-900 dark:text-white">Peran</th>
                  <th className="pb-3 font-semibold text-secondary-900 dark:text-white">Cakupan</th>
                </tr>
              </thead>
              <tbody>
                {authorities.map((auth) => (
                  <tr key={auth.type} className="border-b border-secondary-100 dark:border-secondary-800 hover:bg-secondary-50 dark:hover:bg-secondary-900/50">
                    <td className="py-4">
                      <Badge variant={auth.color as any}>{auth.label}</Badge>
                    </td>
                    <td className="py-4 text-secondary-600 dark:text-secondary-300 text-sm">{auth.desc.split(',')[0]}</td>
                    <td className="py-4 text-secondary-500 dark:text-secondary-400 text-sm">{auth.desc.split(', ')[1]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Status Flow */}
      <section className="py-16 lg:py-24 bg-white dark:bg-secondary-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-secondary-900 dark:text-white mb-4 tracking-tight">
              Alur Status Laporan
            </h2>
            <p className="text-lg text-secondary-600 dark:text-secondary-300 max-w-2xl mx-auto">
              Transparansi penuh dari pengajuan hingga penyelesaian
            </p>
          </div>

          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-secondary-200 dark:bg-secondary-700 hidden lg:block" />

            <div className="space-y-6">
              {statusFlow.map((step, idx) => (
                <div key={step.status} className="relative flex items-start gap-4">
                  <div className={clsx('flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center z-10',
                    `bg-${step.color}-100 dark:bg-${step.color}-900/30 text-${step.color}-600 dark:text-${step.color}-400`
                  )}>
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0 pt-2">
                    <div className="flex items-center gap-3 mb-1">
                      <Badge variant={step.color as any}>{step.label}</Badge>
                      <span className="text-sm text-secondary-500">{step.status}</span>
                    </div>
                    <p className="text-secondary-600 dark:text-secondary-300 text-sm">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-16 lg:py-24 bg-secondary-50 dark:bg-secondary-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-secondary-900 dark:text-white mb-4 tracking-tight">
              Teknologi Modern
            </h2>
            <p className="text-lg text-secondary-600 dark:text-secondary-300 max-w-2xl mx-auto">
              Stack enterprise-grade untuk skalabilitas dan keandalan
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { category: 'Frontend', items: ['Next.js 14 App Router', 'TypeScript', 'Tailwind CSS', 'Zustand', 'React Hook Form', 'Leaflet Maps', 'PWA + Service Worker'] },
              { category: 'Backend', items: ['Fastify', 'TypeScript', 'Prisma ORM', 'PostgreSQL', 'Redis', 'WebSocket', 'Zod Validation'] },
              { category: 'AI & ML', items: ['Agentic Loop', 'Vision Analysis', 'TF-IDF RAG', 'Guardrails', 'Memory System', 'Observability'] },
              { category: 'Infra & DevOps', items: ['Docker', 'Docker Compose', 'Kubernetes Ready', 'Health Checks', 'CI/CD Ready'] },
            ].map((cat) => (
              <Card key={cat.category} className="h-full">
                <div className="p-6">
                  <h3 className="text-lg font-bold text-secondary-900 dark:text-white mb-4 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-accent-500" />
                    {cat.category}
                  </h3>
                  <ul className="space-y-2">
                    {cat.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-secondary-600 dark:text-secondary-300 text-sm">
                        <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-24 road-gradient asphalt-texture">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-6 text-white tracking-tight">
            Siap Membantu Perbaikan Jalan?
          </h2>
          <p className="text-lg text-secondary-300 mb-8 max-w-2xl mx-auto leading-relaxed">
            Bergabung dengan warga yang sudah melaporkan kerusakan jalan melalui Lapor Jalan.
            Laporan Anda, AI kami analisis, instansi bertindak.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login">
              <Button size="lg" className="bg-accent-500 text-secondary-950 hover:bg-accent-400 w-full sm:w-auto text-lg px-8">
                <Globe className="w-5 h-5 mr-2" />
                Mulai Lapor
              </Button>
            </Link>
            <Link href="/info">
              <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 w-full sm:w-auto text-lg px-8">
                Lihat Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-secondary-950 text-secondary-400 py-12 px-4 sm:px-6 lg:px-8 border-t border-secondary-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-white mb-4 font-display">Lapor Jalan</h3>
              <p className="text-sm leading-relaxed">
                Sistem pelaporan kerusakan infrastruktur jalan berbasis AI untuk Indonesia yang lebih baik.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Produk</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/chat" className="hover:text-white transition-colors">Chat Pelaporan</Link></li>
                <li><Link href="/track" className="hover:text-white transition-colors">Tracking Laporan</Link></li>
                <li><Link href="/info" className="hover:text-white transition-colors">Panduan</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Dukungan</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">FAQ</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Kontak Kami</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Dokumentasi API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Kebijakan Privasi</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Syarat Layanan</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-secondary-800 pt-8 text-center text-sm">
            &copy; 2024 Lapor Jalan. Dibangun untuk warga Indonesia.
          </div>
        </div>
      </footer>
    </div>
  );
}
