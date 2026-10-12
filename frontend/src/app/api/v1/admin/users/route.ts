import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import {authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const userQuerySchema = z.object({
  role: z.enum(['CITIZEN', 'ADMIN', 'AUTHORITY_STAFF']).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();
    if (!authUser.roles.includes('ADMIN')) return error('FORBIDDEN', 'Admin only', 403);

    const { searchParams } = new URL(req.url);
    const query = userQuerySchema.parse({
      role: searchParams.get('role') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
      search: searchParams.get('search') || undefined,
    });

    const where: any = {};
    if (query.role) where.role = query.role;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' as const } },
        { email: { contains: query.search, mode: 'insensitive' as const } },
        { phone: { contains: query.search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
        select: {
          id: true, email: true, name: true, phone: true, avatar: true,
          role: true, authorityId: true, createdAt: true,
          _count: { select: { reports: true, sessions: true, notifications: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return ok({ users, total, pagination: { limit: query.limit, offset: query.offset, total } });
  } catch (err) {
    return handleApiError(err);
  }
}
