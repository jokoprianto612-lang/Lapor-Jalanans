import { NextRequest } from 'next/server';
import { getAuthorityById, formatAuthorityContact } from '@/lib/services/authority';
import { ok, error, handleApiError } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authority = await getAuthorityById(params.id);
    if (!authority) {
      return error('NOT_FOUND', 'Instansi tidak ditemukan', 404);
    }

    return ok({
      authority: {
        id: authority.id,
        name: authority.name,
        type: authority.type,
        address: authority.address,
        contactPerson: authority.contactPerson,
        phone: authority.phone,
        whatsapp: authority.whatsapp,
        email: authority.email,
        radius: authority.radius,
      },
      contactInfo: formatAuthorityContact(authority),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
