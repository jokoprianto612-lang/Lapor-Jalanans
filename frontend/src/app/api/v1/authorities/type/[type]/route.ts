import { NextRequest } from 'next/server';
import {authenticate, unauthorized} from '@/lib/auth';
import {handleApiError, ok} from '@/lib/api-helpers';
import { getAuthoritiesByType } from '@/lib/services/authority';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();

    const authorities = await getAuthoritiesByType(params.type as any);
    return ok({ authorities });
  } catch (err) {
    return handleApiError(err);
  }
}
