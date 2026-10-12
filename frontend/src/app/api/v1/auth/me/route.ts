import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import {authenticate, unauthorized} from '@/lib/auth';
import {handleApiError, ok} from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true, email: true, name: true, phone: true, avatar: true,
        role: true, authorityId: true, createdAt: true,
        _count: { select: { reports: true, sessions: true } },
      },
    });

    if (!user) return unauthorized();

    return ok({ user });
  } catch (err) {
    return handleApiError(err);
  }
}
