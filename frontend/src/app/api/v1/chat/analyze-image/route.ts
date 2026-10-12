import { NextRequest } from 'next/server';
import { z } from 'zod';
import {authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';
import { analyzeImage, validateImage } from '@/lib/services/vision';
import { findNearestAuthorities, formatAuthorityContact } from '@/lib/services/authority';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const imageAnalysisSchema = z.object({
  image: z.string(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();

    const data = imageAnalysisSchema.parse(await req.json());

    const validation = validateImage(data.image);
    if (!validation.valid) {
      return error('INVALID_IMAGE', validation.error!, 400);
    }

    const analysis = await analyzeImage(data.image,
      data.latitude && data.longitude ? { lat: data.latitude, lng: data.longitude } : undefined
    );

    let authorities = null;
    if (data.latitude && data.longitude) {
      authorities = await findNearestAuthorities(data.latitude, data.longitude, analysis.damageType, 3);
    }

    return ok({
      analysis,
      authorities: authorities?.map((a: any) => ({
        authority: a.authority,
        distance: a.distance,
        contactInfo: formatAuthorityContact(a.authority),
      })) || [],
    });
  } catch (err) {
    return handleApiError(err);
  }
}
