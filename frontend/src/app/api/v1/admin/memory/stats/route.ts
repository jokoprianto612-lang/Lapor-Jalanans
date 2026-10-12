import { NextRequest } from 'next/server';
import {authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';
import { getMemoryStats } from '@/lib/services/memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();
    if (!authUser.roles.includes('ADMIN')) return error('FORBIDDEN', 'Admin only', 403);

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || undefined;

    const stats = await getMemoryStats(userId);
    return ok({ stats });
  } catch (err) {
    return handleApiError(err);
  }
}
