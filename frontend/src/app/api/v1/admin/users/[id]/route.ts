import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import {authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();
    if (!authUser.roles.includes('ADMIN')) return error('FORBIDDEN', 'Admin only', 403);

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true, email: true, name: true, phone: true, avatar: true,
        role: true, authorityId: true, createdAt: true, updatedAt: true,
        _count: { select: { reports: true, sessions: true, notifications: true } },
        reports: { take: 5, orderBy: { submittedAt: 'desc' }, select: { id: true, trackingCode: true, title: true, status: true, submittedAt: true } },
        sessions: { take: 5, orderBy: { updatedAt: 'desc' }, select: { id: true, title: true, _count: { select: { messages: true } }, updatedAt: true } },
      },
    });

    if (!user) return error('NOT_FOUND', 'User tidak ditemukan', 404);
    return ok({ user });
  } catch (err) {
    return handleApiError(err);
  }
}
