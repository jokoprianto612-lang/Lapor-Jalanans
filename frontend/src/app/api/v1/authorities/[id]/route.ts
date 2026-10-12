import { NextRequest } from 'next/server';
import {authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';
import { getAuthorityById, formatAuthorityContact, generateWhatsAppLink, generateEmailLink } from '@/lib/services/authority';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();

    const authority = await getAuthorityById(params.id);
    if (!authority) {
      return error('NOT_FOUND', 'Instansi tidak ditemukan', 404);
    }

    return ok({
      authority,
      contactInfo: formatAuthorityContact(authority),
      whatsappLink: authority.whatsapp ? generateWhatsAppLink(authority.whatsapp, '') : null,
      emailLink: authority.email ? generateEmailLink(authority.email, '', '') : null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
