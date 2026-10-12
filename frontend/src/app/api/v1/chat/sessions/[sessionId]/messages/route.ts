import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import {authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';
import { guardrails } from '@/lib/services/guardrails';
import { analyzeImage, validateImage } from '@/lib/services/vision';
import { findNearestAuthorities, formatAuthorityContact } from '@/lib/services/authority';
import { appendMessage } from '@/lib/services/memory';
import { runAgent, fallbackRAGQuery } from '@/lib/services/agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const chatMessageSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().max(4000).default(''),
  images: z.array(z.string()).max(5).optional(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).nullable().optional(),
}).refine(data => data.message.length > 0 || (data.images && data.images.length > 0) || data.location, {
  message: 'Message, images, atau location wajib diisi',
});

export async function POST(req: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();

    const { sessionId } = params;
    const data = chatMessageSchema.parse(await req.json());

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== authUser.id) {
      return error('NOT_FOUND', 'Sesi tidak ditemukan', 404);
    }

    const guardResult = guardrails.guardInput(data.message);
    if (!guardResult.allowed) {
      return error('GUARDRAIL_BLOCKED', guardResult.reason, 400);
    }

    await appendMessage(sessionId, authUser.id, 'USER', guardResult.sanitized, {
      images: data.images,
      location: data.location,
    });

    let aiAnalysis = null;
    if (data.images && data.images.length > 0) {
      for (const img of data.images) {
        const validation = validateImage(img);
        if (!validation.valid) {
          return error('INVALID_IMAGE', validation.error!, 400);
        }
      }

      aiAnalysis = await analyzeImage(data.images[0], data.location ? { lat: data.location.latitude, lng: data.location.longitude } : undefined);

      await appendMessage(sessionId, authUser.id, 'SYSTEM', 'Analisis AI selesai', {
        aiAnalysis,
        images: data.images,
      });
    }

    let authorities = null;
    if (data.location) {
      authorities = await findNearestAuthorities(
        data.location.latitude,
        data.location.longitude,
        (aiAnalysis?.damageType as any) || 'OTHER',
        3
      );
    }

    let agentResult;
    try {
      agentResult = await runAgent(authUser.id, sessionId, guardResult.sanitized);
    } catch (agentErr) {
      console.error('[Chat] Agent error, falling back:', agentErr);
      agentResult = await fallbackRAGQuery(authUser.id, sessionId, guardResult.sanitized);
    }

    const outputGuard = guardrails.guardOutput(agentResult.answer);

    return ok({
      message: outputGuard.sanitized,
      aiAnalysis,
      authorities: authorities?.map((a: any) => ({
        authority: a.authority,
        distance: a.distance,
        isWithinRadius: a.isWithinRadius,
        contactInfo: formatAuthorityContact(a.authority),
      })) || [],
      metadata: {
        toolCalls: agentResult.toolCalls,
        steps: agentResult.steps,
        duration: agentResult.duration,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
