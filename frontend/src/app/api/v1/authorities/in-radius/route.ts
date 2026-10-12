import { NextRequest } from 'next/server';
import { z } from 'zod';
import {authenticate, unauthorized} from '@/lib/auth';
import {handleApiError, ok} from '@/lib/api-helpers';
import { getAuthoritiesInRadius } from '@/lib/services/authority';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const radiusSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z.coerce.number().min(100).max(100000).default(10000),
});

export async function POST(req: NextRequest) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();

    const data = radiusSchema.parse(await req.json());
    const authorities = await getAuthoritiesInRadius(data.latitude, data.longitude, data.radius);

    return ok({ authorities });
  } catch (err) {
    return handleApiError(err);
  }
}
