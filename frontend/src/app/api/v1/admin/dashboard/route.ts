import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import {authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';
import { getReportStats } from '@/lib/services/report';
import { computeMetrics } from '@/lib/services/observability';
import { getMemoryStats } from '@/lib/services/memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const statsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  userId: z.string().uuid().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();
    if (!authUser.roles.includes('ADMIN')) return error('FORBIDDEN', 'Admin only', 403);

    const { searchParams } = new URL(req.url);
    const query = statsQuerySchema.parse({
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      userId: searchParams.get('userId') || undefined,
    });

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    const [reportStats, userCount, sessionCount, aiMetrics] = await Promise.all([
      getReportStats(query.userId, startDate, endDate),
      prisma.user.count(),
      prisma.session.count(),
      computeMetrics(),
    ]);

    return ok({
      reports: reportStats,
      users: { total: userCount },
      sessions: { total: sessionCount },
      ai: aiMetrics,
      period: { startDate, endDate },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
