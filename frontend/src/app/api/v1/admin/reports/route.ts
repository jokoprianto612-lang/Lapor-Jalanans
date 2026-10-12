import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import {authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();
    if (!authUser.roles.includes('ADMIN')) return error('FORBIDDEN', 'Admin only', 403);

    const { searchParams } = new URL(req.url);
    const query = z.object({
      status: z.enum(['SUBMITTED','ANALYZING','VERIFIED','ROUTED','IN_PROGRESS','RESOLVED','REJECTED','CLOSED']).optional(),
      damageType: z.enum(['POTHOLE','CRACK','SUBSIDENCE','DRAINAGE','SIGN_DAMAGE','LIGHTING','OTHER']).optional(),
      severity: z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).optional(),
      limit: z.coerce.number().min(1).max(100).default(50),
      offset: z.coerce.number().min(0).default(0),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    }).parse({
      status: searchParams.get('status') || undefined,
      damageType: searchParams.get('damageType') || undefined,
      severity: searchParams.get('severity') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    });

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.damageType) where.damageType = query.damageType;
    if (query.severity) where.severity = query.severity;
    if (query.startDate || query.endDate) {
      where.submittedAt = {};
      if (query.startDate) where.submittedAt.gte = new Date(query.startDate);
      if (query.endDate) where.submittedAt.lte = new Date(query.endDate);
    }

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        take: query.limit,
        skip: query.offset,
        include: {
          reporter: { select: { id: true, name: true, phone: true, email: true } },
          assignee: { select: { id: true, name: true } },
          updates: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      prisma.report.count({ where }),
    ]);

    return ok({ reports, total, pagination: { limit: query.limit, offset: query.offset, total } });
  } catch (err) {
    return handleApiError(err);
  }
}
