import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/password';
import {signToken, setAuthCookie, authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password minimal 8 karakter'),
});

export async function POST(req: NextRequest) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();

    const data = changePasswordSchema.parse(await req.json());

    const dbUser = await prisma.user.findUnique({ where: { id: authUser.id } });
    if (!dbUser) return error('NOT_FOUND', 'User not found', 404);

    if (!verifyPassword(data.currentPassword, dbUser.passwordHash)) {
      return error('INVALID_PASSWORD', 'Password saat ini salah', 401);
    }

    const updated = await prisma.user.update({
      where: { id: authUser.id },
      data: {
        passwordHash: hashPassword(data.newPassword),
        tokenVersion: { increment: 1 },
      },
    });

    const token = signToken({ id: updated.id, email: updated.email, role: updated.role, authorityId: updated.authorityId || undefined, tokenVersion: updated.tokenVersion });
    const res = ok({ message: 'Password berhasil diubah', token });
    setAuthCookie(res, token);
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
