import { NextRequest } from 'next/server';
import { handleApiError } from '@/lib/api-helpers';
import { ok, error } from '@/lib/api-helpers';
import { getPublicTrackingData } from '@/lib/services/report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { trackingCode: string } }) {
  try {
    const report = await getPublicTrackingData(params.trackingCode);
    if (!report) {
      return error('NOT_FOUND', 'Kode tracking tidak ditemukan', 404);
    }

    return ok({ report });
  } catch (err) {
    return handleApiError(err);
  }
}
