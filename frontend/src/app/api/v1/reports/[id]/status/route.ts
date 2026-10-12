import { NextRequest } from 'next/server';
import { z } from 'zod';
import {authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';
import { updateReportStatus } from '@/lib/services/report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateStatusSchema = z.object({
  status: z.enum(['SUBMITTED','ANALYZING','VERIFIED','ROUTED','IN_PROGRESS','RESOLVED','REJECTED','CLOSED']),
  message: z.string().min(1).max(1000),
  images: z.array(z.string()).max(5).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();

    if (!authUser.roles.includes('ADMIN') && !authUser.roles.includes('AUTHORITY_STAFF')) {
      return error('FORBIDDEN', 'Hanya petugas yang bisa update status', 403);
    }

    const data = updateStatusSchema.parse(await req.json());

    const report = await updateReportStatus(params.id, authUser.id, data.status as any, data.message, data.images || []);
    if (!report) {
      return error('NOT_FOUND', 'Laporan tidak ditemukan', 404);
    }

    return ok({ report });
  } catch (err) {
    return handleApiError(err);
  }
}
