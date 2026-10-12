import { NextRequest } from 'next/server';
import {authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';
import { getReportById } from '@/lib/services/report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();

    const report = await getReportById(params.id);
    if (!report) {
      return error('NOT_FOUND', 'Laporan tidak ditemukan', 404);
    }

    // Ownership check: reporter, assignee, admin, or authority staff
    const isReporter = report.reporterId === authUser.id;
    const isAssignee = report.assigneeId === authUser.id;
    const isAdmin = authUser.roles.includes('ADMIN');
    const isStaff = authUser.roles.includes('AUTHORITY_STAFF');

    if (!isReporter && !isAssignee && !isAdmin && !isStaff) {
      return error('FORBIDDEN', 'Akses ditolak', 403);
    }

    return ok({ report });
  } catch (err) {
    return handleApiError(err);
  }
}
