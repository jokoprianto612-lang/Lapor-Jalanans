import { NextRequest } from 'next/server';
import { z } from 'zod';
import {authenticate, unauthorized} from '@/lib/auth';
import {handleApiError, ok} from '@/lib/api-helpers';
import { findNearestAuthorities, formatAuthorityContact, generateWhatsAppLink, generateEmailLink } from '@/lib/services/authority';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const nearbySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  damageType: z.enum(['POTHOLE','CRACK','SUBSIDENCE','DRAINAGE','SIGN_DAMAGE','LIGHTING','OTHER']).optional(),
  limit: z.coerce.number().min(1).max(20).default(5),
});

export async function POST(req: NextRequest) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();

    const data = nearbySchema.parse(await req.json());

    const authorities = await findNearestAuthorities(
      data.latitude,
      data.longitude,
      data.damageType || 'OTHER',
      data.limit,
    );

    return ok({
      authorities: authorities.map(a => ({
        authority: a.authority,
        distance: a.distance,
        isWithinRadius: a.isWithinRadius,
        contactInfo: formatAuthorityContact(a.authority),
        whatsappLink: a.authority.whatsapp ? generateWhatsAppLink(a.authority.whatsapp, `Laporan kerusakan jalan di area ${a.authority.name}`) : null,
        emailLink: a.authority.email ? generateEmailLink(a.authority.email, 'Laporan Kerusakan Jalan', 'Detail laporan...') : null,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
