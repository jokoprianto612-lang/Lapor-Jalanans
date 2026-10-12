import { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticate, unauthorized } from '@/lib/auth';
import { error, handleApiError, ok } from '@/lib/api-helpers';
import { createReport, generateTrackingCode } from '@/lib/services/report';
import { analyzeImage, validateImage } from '@/lib/services/vision';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createReportSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(2000),
  damageType: z.enum(['POTHOLE', 'CRACK', 'SUBSIDENCE', 'DRAINAGE', 'SIGN_DAMAGE', 'LIGHTING', 'OTHER']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().min(5).max(500),
  images: z.array(z.string()).min(1).max(5),
});

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return unauthorized();
    }

    const body = await request.json();
    const validation = createReportSchema.safeParse(body);

    if (!validation.success) {
      return error('VALIDATION_ERROR', validation.error.issues[0]?.message ?? 'Invalid input', 400);
    }

    const { title, description, damageType, severity, latitude, longitude, address, images } = validation.data;

    // Validate first image
    if (images.length > 0) {
      const validation = validateImage(images[0]);
      if (!validation.valid) {
        return error('INVALID_IMAGE', validation.error ?? 'Invalid image', 400);
      }
    }

    // Analyze first image with AI
    let aiAnalysis = null;
    let finalDamageType = damageType;
    let finalSeverity = severity;

    if (images.length > 0) {
      aiAnalysis = await analyzeImage(images[0], { lat: latitude, lng: longitude });
      if (aiAnalysis && aiAnalysis.confidence > 0.7) {
        if (aiAnalysis.damageType) finalDamageType = aiAnalysis.damageType;
        if (aiAnalysis.severity) finalSeverity = aiAnalysis.severity;
      }
    }

    const trackingCode = generateTrackingCode();

    const report = await createReport({
      title,
      description,
      damageType: finalDamageType as any,
      severity: finalSeverity as any,
      latitude,
      longitude,
      address,
      images,
      trackingCode,
      reporterId: user.id,
    });

    return ok({ report, aiAnalysis }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
