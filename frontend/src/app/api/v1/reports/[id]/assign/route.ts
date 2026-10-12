import { NextRequest } from 'next/server';
import {authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';
import { assignReport } from '@/lib/services/report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return unauthorized();
    }

    if (!user.roles.includes('ADMIN')) {
      return error('FORBIDDEN:_ADMIN_ACCESS_REQUIRED', 'Forbidden: Admin access required', 403);
    }

    const body = await request.json();
    const { assigneeId } = body;

    if (!assigneeId || typeof assigneeId !== 'string') {
      return error('ASSIGNEEID_IS_REQUIRED', 'assigneeId is required', 400);
    }

    // UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(assigneeId)) {
      return error('ASSIGNEEID_MUST_BE_A_VALID_UUID', 'assigneeId must be a valid UUID', 400);
    }

    const report = await assignReport(params.id, assigneeId, user.id);

    return ok({ report });
  } catch (err) {
    return handleApiError(err);
  }
}
