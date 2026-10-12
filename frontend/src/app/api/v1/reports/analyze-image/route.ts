import { NextRequest } from 'next/server';
import {authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';
import { validateImage, analyzeImage } from '@/lib/services/vision';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return unauthorized();
    }

    const body = await request.json();
    const { image, latitude, longitude } = body;

    if (!image || typeof image !== 'string') {
      return error('IMAGE_IS_REQUIRED_AND_MUST_BE_A_STRING', 'image is required and must be a string', 400);
    }

    if (latitude !== undefined && (typeof latitude !== 'number' || latitude < -90 || latitude > 90)) {
      return error('LATITUDE_MUST_BE_A_NUMBER_BETWEEN_-90_AND_90', 'latitude must be a number between -90 and 90', 400);
    }

    if (longitude !== undefined && (typeof longitude !== 'number' || longitude < -180 || longitude > 180)) {
      return error('LONGITUDE_MUST_BE_A_NUMBER_BETWEEN_-180_AND_180', 'longitude must be a number between -180 and 180', 400);
    }

    const isValid = await validateImage(image);
    if (!isValid) {
      return error('INVALID_IMAGE_FORMAT', 'Invalid image format', 400);
    }

    const analysis = await analyzeImage(image, latitude && longitude ? { lat: latitude, lng: longitude } : undefined);

    return ok({ analysis });
  } catch (err) {
    return handleApiError(err);
  }
}
