import { NextRequest } from 'next/server';
import {authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';
import { findNearestAuthorities } from '@/lib/services/authority';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return unauthorized();
    }

    const body = await request.json();
    const { latitude, longitude, damageType } = body;

    if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
      return error('LATITUDE_MUST_BE_A_NUMBER_BETWEEN_-90_AND_90', 'latitude must be a number between -90 and 90', 400);
    }

    if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
      return error('LONGITUDE_MUST_BE_A_NUMBER_BETWEEN_-180_AND_180', 'longitude must be a number between -180 and 180', 400);
    }

    if (!damageType || typeof damageType !== 'string') {
      return error('DAMAGETYPE_IS_REQUIRED', 'damageType is required', 400);
    }

    const authorities = await findNearestAuthorities(latitude, longitude, damageType as any);

    return ok({ authorities });
  } catch (err) {
    return handleApiError(err);
  }
}
