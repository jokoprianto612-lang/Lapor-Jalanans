import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import {signToken, setAuthCookie} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const registerSchema = z.object({
  email: z.string().email('Email tidak valid'),
  phone: z.string().regex(/^(08|628)\d{8,11}$/, 'Nomor HP tidak valid').optional(),
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100),
  password: z.string().min(8, 'Password minimal 8 karakter'),
});

export async function POST(req: NextRequest) {
  try {
    const data = registerSchema.parse(await req.json());

    const existingEmail = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingEmail) {
      return error('EMAIL_EXISTS', 'Email sudah terdaftar', 409);
    }

    if (data.phone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone: data.phone } });
      if (existingPhone) {
        return error('PHONE_EXISTS', 'Nomor HP sudah terdaftar', 409);
      }
    }

    const passwordHash = hashPassword(data.password);
    const user = await prisma.user.create({
      data: { email: data.email, phone: data.phone, name: data.name, passwordHash, role: 'CITIZEN' },
      select: { id: true, email: true, name: true, role: true, createdAt: true, authorityId: true, tokenVersion: true },
    });

    const token = signToken({ id: user.id, email: user.email, role: user.role, authorityId: user.authorityId || undefined, tokenVersion: user.tokenVersion });
    const res = ok({ user, token });
    setAuthCookie(res, token);
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
