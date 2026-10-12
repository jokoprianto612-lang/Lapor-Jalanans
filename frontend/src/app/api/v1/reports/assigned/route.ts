import { NextRequest } from 'next/server';
import { authenticate, unauthorized } from '@/lib/auth';
import { error, handleApiError, ok } from '@/lib/api-helpers';
import { getReportsByAssignee } from '@/lib/services/report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const limit = parseInt(searchParams.get('limit') ?? '20', 10);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    const validStatuses = ['SUBMITTED', 'ANALYZING', 'VERIFIED', 'ROUTED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED'];
    if (status && !validStatuses.includes(status)) {
      return error('INVALID_STATUS_VALUE', 'Invalid status value', 400);
    }

    const reports = await getReportsByAssignee(user.id, {
      status: status as any,
      limit,
      offset,
    });

    return ok({ reports });
  } catch (err) {
    return handleApiError(err);
  }
}
