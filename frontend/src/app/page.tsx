'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import Link from 'next/link';
import { Construction, MapPin, Shield, Clock } from 'lucide-react';

function RoadLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx="14" fill="#18181b" />
      <path d="M14 52 L28 12 L36 12 L50 52 Z" fill="#3f3f46" />
      <path d="M14 52 L28 12" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M50 52 L36 12" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="32" y1="14" x2="32" y2="22" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="32" y1="28" x2="32" y2="36" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="32" y1="42" x2="32" y2="50" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="32" cy="32" rx="5" ry="4" fill="#f97316" opacity="0.9" />
      <ellipse cx="32" cy="32" rx="3" ry="2.5" fill="#c2410c" />
    </svg>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated !== null) {
      router.push(isAuthenticated ? '/chat' : '/login');
    }
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen flex items-center justify-center road-gradient asphalt-texture px-4">
      <div className="text-center animate-in max-w-2xl">
        <div className="mb-8 flex justify-center">
          <RoadLogo className="w-20 h-20" />
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
          Lapor Jalan
        </h1>
        <p className="text-lg text-secondary-300 mb-8 max-w-lg mx-auto leading-relaxed">
          Foto kerusakan jalan, kirim. AI analisis, teruskan ke instansi berwenang.
          Semua otomatis.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link href="/login" className="btn-primary px-8 py-3 text-base font-semibold">
            Mulai Lapor
          </Link>
          <Link href="/info" className="btn-outline px-8 py-3 text-base border-white/20 text-white hover:bg-white/10">
            Lihat Cara Kerja
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm">
          <div className="flex flex-col items-center gap-2">
            <Construction className="w-5 h-5 text-accent-400" />
            <span className="text-secondary-400">6 Jenis Kerusakan</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <MapPin className="w-5 h-5 text-accent-400" />
            <span className="text-secondary-400">Auto Routing 10 Instansi</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Clock className="w-5 h-5 text-accent-400" />
            <span className="text-secondary-400">24/7 AI Analysis</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Shield className="w-5 h-5 text-accent-400" />
            <span className="text-secondary-400">Tracking Transparan</span>
          </div>
        </div>
      </div>
    </div>
  );
}
