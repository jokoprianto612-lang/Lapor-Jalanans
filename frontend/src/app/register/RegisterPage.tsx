'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Card } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { Mail, Lock, User, Phone, AlertCircle, Eye, EyeOff, CheckCircle, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

const registerSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100),
  email: z.string().email('Email tidak valid'),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, 'Nomor telepon tidak valid').optional().or(z.literal('')),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Password tidak cocok',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

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

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser, isLoading, error: authError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setLocalError(null);
    try {
      await registerUser({ email: data.email, name: data.name, password: data.password });
      toast.success('Akun berhasil dibuat!');
      router.push('/chat');
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'Registrasi gagal';
      setLocalError(message);
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center road-gradient asphalt-texture px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <RoadLogo className="w-14 h-14" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">Daftar Akun</h1>
          <p className="text-secondary-400 mt-1 text-sm">Mulai laporkan kerusakan jalan</p>
        </div>

        <Card className="p-6 sm:p-8 animate-in bg-secondary-900/80 backdrop-blur border-secondary-700">
          {(localError || authError) && (
            <div className="mb-6 flex items-center gap-2 p-3 bg-danger-500/10 border border-danger-500/30 rounded-lg text-danger-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{localError || authError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Nama Lengkap"
              placeholder="Nama Anda"
              leftIcon={<User className="w-5 h-5" />}
              {...register('name')}
              error={errors.name?.message}
              disabled={isLoading}
            />

            <Input
              label="Email"
              type="email"
              placeholder="nama@email.com"
              leftIcon={<Mail className="w-5 h-5" />}
              {...register('email')}
              error={errors.email?.message}
              autoComplete="email"
              disabled={isLoading}
            />

            <Input
              label="Nomor Telepon (Opsional)"
              type="tel"
              placeholder="+628****7890"
              leftIcon={<Phone className="w-5 h-5" />}
              {...register('phone')}
              error={errors.phone?.message}
              autoComplete="tel"
              disabled={isLoading}
            />

            <div className="relative">
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={clsx('input pl-10 pr-12', errors.password && 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20')}
                  {...register('password')}
                  disabled={isLoading}
                  autoComplete="new-password"
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-200 transition-colors"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-danger-400" role="alert">{errors.password.message}</p>
              )}
            </div>

            <div className="relative">
              <label className="label">Konfirmasi Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={clsx('input pl-10 pr-12', errors.confirmPassword && 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20')}
                  {...register('confirmPassword')}
                  disabled={isLoading}
                  autoComplete="new-password"
                />
                <CheckCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-200 transition-colors"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-danger-400" role="alert">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" size="lg" loading={isLoading}>
              {isLoading ? 'Mendaftar...' : 'Daftar'}
              {!isLoading && <ArrowRight className="w-4 h-4" />}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-secondary-400">
            Sudah punya akun?{' '}
            <Link href="/login" className="text-accent-400 hover:text-accent-300 font-medium transition-colors">
              Masuk di sini
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
