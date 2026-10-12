import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/password';
import { signToken, setAuthCookie } from '@/lib/auth';
import { error, handleApiError, ok } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ─────────────────────────────────────────────
// Brute-force protection (per-account lockout).
//
// CAVEAT (jujur): ini in-memory, jadi di Vercel serverless state-nya
// per-instance dan hilang saat cold start. Artinya ini menghambat burst
// pada satu instance, TIDAK memberi jaminan global. Untuk proteksi yang
// tahan multi-instance, ganti ke shared store (Upstash Redis) atau
// Vercel Firewall rate limiting. Lihat SECURITY.md.
// ─────────────────────────────────────────────
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

type Attempt = { count: number; resetAt: number; lockedUntil: number | null };
const attempts = new Map<string, Attempt>();

function lockedForMs(key: string): number {
  const rec = attempts.get(key);
  if (!rec) return 0;
  const now = Date.now();
  if (rec.lockedUntil && now < rec.lockedUntil) return rec.lockedUntil - now;
  if (now > rec.resetAt) attempts.delete(key);
  return 0;
}

function recordFailure(key: string): void {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now > rec.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS, lockedUntil: null });
    return;
  }
  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) rec.lockedUntil = now + LOCK_MS;
}

function clearFailures(key: string): void {
  attempts.delete(key);
}

export async function POST(req: NextRequest) {
  try {
    const data = loginSchema.parse(await req.json());
    const key = data.email.toLowerCase();

    const locked = lockedForMs(key);
    if (locked > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'LOGIN_LOCKED',
            message: `Terlalu banyak percobaan login. Coba lagi dalam ${Math.ceil(locked / 1000)} detik`,
            statusCode: 429,
          },
        },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(locked / 1000)) } }
      );
    }

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user || !verifyPassword(data.password, user.passwordHash)) {
      recordFailure(key);
      return error('INVALID_CREDENTIALS', 'Email atau password salah', 401);
    }

    clearFailures(key);

    const token = signToken({ id: user.id, email: user.email, role: user.role, authorityId: user.authorityId || undefined, tokenVersion: user.tokenVersion });
    const res = ok({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, authorityId: user.authorityId, avatar: user.avatar },
      token,
    });
    setAuthCookie(res, token);
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
