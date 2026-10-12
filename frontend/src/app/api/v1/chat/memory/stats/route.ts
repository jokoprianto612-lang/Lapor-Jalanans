import { NextRequest } from 'next/server';
import {authenticate, unauthorized} from '@/lib/auth';
import {handleApiError, ok} from '@/lib/api-helpers';
import { getMemoryStats } from '@/lib/services/memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();

    const stats = await getMemoryStats(authUser.id);
    return ok({ stats });
  } catch (err) {
    return handleApiError(err);
  }
}
