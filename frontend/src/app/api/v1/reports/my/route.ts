import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import {authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';
import { getReportsByReporter } from '@/lib/services/report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  status: z.enum(['SUBMITTED','ANALYZING','VERIFIED','ROUTED','IN_PROGRESS','RESOLVED','REJECTED','CLOSED']).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export async function GET(req: NextRequest) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();

    const { searchParams } = new URL(req.url);
    const query = querySchema.parse({
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    });

    const result = await getReportsByReporter(authUser.id, {
      status: query.status as any,
      limit: query.limit,
      offset: query.offset,
    });

    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
