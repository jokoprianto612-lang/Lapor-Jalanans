import { NextRequest } from 'next/server';
import {authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';
import { getRecentTraces } from '@/lib/services/observability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();
    if (!authUser.roles.includes('ADMIN')) return error('FORBIDDEN', 'Admin only', 403);

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const sessionId = searchParams.get('sessionId') || undefined;

    const traces = getRecentTraces(limit, sessionId);
    return ok({ traces });
  } catch (err) {
    return handleApiError(err);
  }
}
