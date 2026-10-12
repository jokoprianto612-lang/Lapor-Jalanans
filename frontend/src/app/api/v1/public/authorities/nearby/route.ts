import { NextRequest, NextResponse } from 'next/server';
import { findNearestAuthorities, formatAuthorityContact } from '@/lib/services/authority';
import { ok, error, handleApiError } from '@/lib/api-helpers';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const nearbySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  damageType: z.enum(['POTHOLE','CRACK','SUBSIDENCE','DRAINAGE','SIGN_DAMAGE','LIGHTING','OTHER']).optional(),
  limit: z.coerce.number().min(1).max(10).default(5),
});

export async function POST(req: NextRequest) {
  try {
    const data = nearbySchema.parse(await req.json());

    const authorities = await findNearestAuthorities(
      data.latitude,
      data.longitude,
      data.damageType || 'OTHER',
      data.limit,
    );

    return ok({
      authorities: authorities.map(a => ({
        id: a.authority.id,
        name: a.authority.name,
        type: a.authority.type,
        distance: a.distance,
        isWithinRadius: a.isWithinRadius,
        address: a.authority.address,
        contactPerson: a.authority.contactPerson,
        phone: a.authority.phone,
        whatsapp: a.authority.whatsapp,
        email: a.authority.email,
        contactInfo: formatAuthorityContact(a.authority),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
