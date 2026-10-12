import { NextRequest } from 'next/server';
import { getAuthoritiesByType } from '@/lib/services/authority';
import { ok, handleApiError } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  try {
    const authorities = await getAuthoritiesByType(params.type as any);
    return ok({ authorities });
  } catch (err) {
    return handleApiError(err);
  }
}
