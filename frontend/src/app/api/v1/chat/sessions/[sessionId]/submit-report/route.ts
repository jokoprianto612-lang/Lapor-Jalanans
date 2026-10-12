import { NextRequest } from 'next/server';
import {authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';
import { prisma } from '@/lib/db';
import { validateImage } from '@/lib/services/vision';
import { createReport, generateTrackingCode } from '@/lib/services/report';
import { notifyReportSubmitted } from '@/lib/services/notification';
import { appendMessage } from '@/lib/services/memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();

    const { sessionId } = params;
    const { title, description, damageType, severity, latitude, longitude, address, images, aiAnalysis } = await req.json() as any;

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== authUser.id) {
      return error('NOT_FOUND', 'Sesi tidak ditemukan', 404);
    }

    for (const img of images || []) {
      const validation = validateImage(img);
      if (!validation.valid) {
        return error('INVALID_IMAGE', validation.error!, 400);
      }
    }

    const trackingCode = generateTrackingCode();
    const report = await createReport({
      title,
      description,
      damageType: damageType as any,
      severity: severity as any,
      latitude,
      longitude,
      address,
      images: images || [],
      aiAnalysis,
      trackingCode,
      reporterId: authUser.id,
    });

    await notifyReportSubmitted(authUser.id, report.id, trackingCode, title, address, damageType, severity);

    await appendMessage(sessionId, authUser.id, 'SYSTEM', 'Laporan resmi telah dibuat', {
      reportId: report.id,
      trackingCode,
      report,
    });

    return ok({ report, trackingCode });
  } catch (err) {
    return handleApiError(err);
  }
}
