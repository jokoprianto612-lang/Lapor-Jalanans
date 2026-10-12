import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import {authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();
    if (!authUser.roles.includes('ADMIN')) return error('FORBIDDEN', 'Admin only', 403);

    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const deleted = await prisma.session.deleteMany({
      where: { updatedAt: { lt: cutoff } },
    });

    return ok({ deletedSessions: deleted.count });
  } catch (err) {
    return handleApiError(err);
  }
}
