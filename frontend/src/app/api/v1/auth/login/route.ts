import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/password';
import {signToken, setAuthCookie, authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const data = loginSchema.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user || !verifyPassword(data.password, user.passwordHash)) {
      return error('INVALID_CREDENTIALS', 'Email atau password salah', 401);
    }

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
