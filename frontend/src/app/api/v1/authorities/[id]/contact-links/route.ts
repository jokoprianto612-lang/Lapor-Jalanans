import { NextRequest } from 'next/server';
import { authenticate, unauthorized } from '@/lib/auth';
import { ok, error, handleApiError } from '@/lib/api-helpers';
import {
  getAuthorityById,
  generateWhatsAppLink,
  generateEmailLink,
  formatAuthorityContact,
} from '@/lib/services/authority';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();

    const authority = await getAuthorityById(params.id);
    if (!authority) return error('NOT_FOUND', 'Authority tidak ditemukan', 404);

    const url = new URL(req.url);
    const message = url.searchParams.get('message') || '';
    const reportUrl = url.searchParams.get('reportUrl') || '';

    const whatsappLink = authority.whatsapp
      ? generateWhatsAppLink(authority.whatsapp, message || `Laporan: ${reportUrl || authority.name}`)
      : null;

    const emailLink = authority.email
      ? generateEmailLink(
          authority.email,
          `Laporan: ${authority.name}`,
          reportUrl ? `Detail laporan: ${reportUrl}` : message || ''
        )
      : null;

    return ok({
      authority: {
        id: authority.id,
        name: authority.name,
        type: authority.type,
        contact: formatAuthorityContact(authority),
      },
      links: {
        whatsapp: whatsappLink,
        email: emailLink,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
