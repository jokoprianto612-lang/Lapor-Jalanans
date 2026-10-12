import { NextRequest } from 'next/server';
import { authenticate, unauthorized } from '@/lib/auth';
import { ok, error, handleApiError } from '@/lib/api-helpers';
import { getAdministrativeBoundary } from '@/lib/services/authority';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();

    const body = await req.json();
    const { latitude, longitude } = body;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return error('VALIDATION_ERROR', 'latitude and longitude must be numbers', 400);
    }

    const boundary = await getAdministrativeBoundary(latitude, longitude);
    return ok({ boundary });
  } catch (err) {
    return handleApiError(err);
  }
}
