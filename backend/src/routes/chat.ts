// Chat Routes - Conversational AI interface for reporting

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { runAgent, fallbackRAGQuery, getAgentConfig } from '../services/agent.js';
import { guardrails } from '../services/guardrails.js';
import { appendMessage, getRecentMessages, buildMemoryContext, getMemoryStats } from '../services/memory.js';
import { recordTrace } from '../services/observability.js';
import { analyzeImage, validateImage } from '../services/vision.js';
import { findNearestAuthorities, formatAuthorityContact } from '../services/authority.js';
import { createReport, generateTrackingCode } from '../services/report.js';
import { notifyReportSubmitted } from '../services/notification.js';
import { userRateLimit } from '../middleware/auth.js';

import { prisma } from '../lib/db.js';

// ─────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────

const chatMessageSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().max(4000).default(''),
  images: z.array(z.string()).max(5).optional(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180)
  }).nullable().optional()
}).refine(data => data.message.length > 0 || (data.images && data.images.length > 0) || data.location, {
  message: 'Message, images, atau location wajib diisi'
});

const newSessionSchema = z.object({
  title: z.string().max(100).optional()
});

const imageAnalysisSchema = z.object({
  image: z.string(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional()
});

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────

export const chatRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  
  // Create new chat session
  app.post('/sessions', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const data = newSessionSchema.parse(request.body);
    
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        title: data.title || 'Laporan Baru'
      }
    });
    
    return reply.status(201).send({
      success: true,
      data: { session: { id: session.id, title: session.title, createdAt: session.createdAt } }
    });
  });
  
  // Get user's chat sessions
  app.get('/sessions', { preHandler: [app.authenticate] }, async (request) => {
    const user = (request as any).user;
    const { limit = 20, offset = 0 } = request.query as { limit?: number; offset?: number };
    
    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
        include: { 
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          _count: { select: { messages: true } }
        }
      }),
      prisma.session.count({ where: { userId: user.id } })
    ]);
    
    return {
      success: true,
      data: {
        sessions: sessions.map((s) => ({
          id: s.id,
          title: s.title,
          messageCount: s._count.messages,
          lastMessage: s.messages[0] ? { role: s.messages[0].role, content: s.messages[0].content.substring(0, 100) } : null,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt
        })),
        total
      }
    };
  });
  
  // Get session messages
  app.get('/sessions/:sessionId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };
    const { limit = 50, before } = request.query as { limit?: number; before?: string };
    
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== user.id) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sesi tidak ditemukan', statusCode: 404 } });
    }
    
    const where: any = { sessionId };
    if (before) where.createdAt = { lt: new Date(before) };
    
    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    
    return {
      success: true,
      data: {
        session: { id: session.id, title: session.title },
        messages: messages.reverse().map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          metadata: m.metadata,
          createdAt: m.createdAt
        }))
      }
    };
  });
  
  // Send message to AI agent
  // 30 pesan/menit per user — cegah pembakaran kuota LLM
  app.post('/sessions/:sessionId/messages', { preHandler: [app.authenticate, userRateLimit(30, 60 * 1000)] }, async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };
    const data = chatMessageSchema.parse(request.body);
    
    // Verify session ownership
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== user.id) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sesi tidak ditemukan', statusCode: 404 } });
    }
    
    // Guardrails check on input
    const guardResult = guardrails.guardInput(data.message);
    if (!guardResult.allowed) {
      return reply.status(400).send({
        success: false,
        error: { code: 'GUARDRAIL_BLOCKED', message: guardResult.reason, statusCode: 400 }
      });
    }
    
    // Save user message
    await appendMessage(sessionId, user.id, 'USER', guardResult.sanitized, {
      images: data.images,
      location: data.location
    });
    
    // Analyze images if provided
    let aiAnalysis = null;
    if (data.images && data.images.length > 0) {
      for (const img of data.images) {
        const validation = validateImage(img);
        if (!validation.valid) {
          return reply.status(400).send({
            success: false,
            error: { code: 'INVALID_IMAGE', message: validation.error, statusCode: 400 }
          });
        }
      }
      
      // Analyze first image
      aiAnalysis = await analyzeImage(data.images[0], data.location ? { lat: data.location.latitude, lng: data.location.longitude } : undefined);
      
      // Save analysis as system message
      await appendMessage(sessionId, user.id, 'SYSTEM', 'Analisis AI selesai', {
        aiAnalysis,
        images: data.images
      });
    }
    
    // Find authorities if location provided
    let authorities = null;
    if (data.location) {
      authorities = await findNearestAuthorities(
        data.location.latitude,
        data.location.longitude,
        aiAnalysis?.damageType || 'OTHER',
        3
      );
    }
    
    // Run agent
    let agentResult;
    try {
      agentResult = await runAgent(user.id, sessionId, guardResult.sanitized);
    } catch (error) {
      console.error('[Chat] Agent error, falling back:', error);
      agentResult = await fallbackRAGQuery(user.id, sessionId, guardResult.sanitized);
    }
    
    // Guardrails check on output
    const outputGuard = guardrails.guardOutput(agentResult.answer);
    
    // Prepare response
    const response = {
      message: outputGuard.sanitized,
      aiAnalysis,
      authorities: authorities?.map(a => ({
        authority: a.authority,
        distance: a.distance,
        isWithinRadius: a.isWithinRadius,
        contactInfo: formatAuthorityContact(a.authority)
      })) || [],
      metadata: {
        toolCalls: agentResult.toolCalls,
        steps: agentResult.steps,
        duration: agentResult.duration
      }
    };
    
    return { success: true, data: response };
  });
  
  // Quick image analysis endpoint (without session)
  app.post('/analyze-image', { preHandler: [app.authenticate] }, async (request, reply) => {
    const data = imageAnalysisSchema.parse(request.body);
    
    const validation = validateImage(data.image);
    if (!validation.valid) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_IMAGE', message: validation.error, statusCode: 400 } });
    }
    
    const analysis = await analyzeImage(data.image, 
      data.latitude && data.longitude ? { lat: data.latitude, lng: data.longitude } : undefined
    );
    
    // Also find authorities
    let authorities = null;
    if (data.latitude && data.longitude) {
      authorities = await findNearestAuthorities(
        data.latitude, data.longitude, analysis.damageType, 3
      );
    }
    
    return {
      success: true,
      data: {
        analysis,
        authorities: authorities?.map(a => ({
          authority: a.authority,
          distance: a.distance,
          contactInfo: formatAuthorityContact(a.authority)
        })) || []
      }
    };
  });
  
  // Submit report from chat (create formal report)
  const submitReportSchema = z.object({
    title: z.string().min(5).max(200),
    description: z.string().min(10).max(2000),
    damageType: z.enum(['POTHOLE', 'CRACK', 'SUBSIDENCE', 'DRAINAGE', 'SIGN_DAMAGE', 'LIGHTING', 'OTHER']),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    address: z.string().min(5).max(500),
    images: z.array(z.string()).max(5).default([]),
    aiAnalysis: z.any().optional(),
  });

  app.post('/sessions/:sessionId/submit-report', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };
    const { title, description, damageType, severity, latitude, longitude, address, images, aiAnalysis } = submitReportSchema.parse(request.body);
    
    // Verify session
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== user.id) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sesi tidak ditemukan', statusCode: 404 } });
    }
    
    // Validate images
    for (const img of images || []) {
      const validation = validateImage(img);
      if (!validation.valid) {
        return reply.status(400).send({ success: false, error: { code: 'INVALID_IMAGE', message: validation.error, statusCode: 400 } });
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
      reporterId: user.id
    });
    
    // Notify
    await notifyReportSubmitted(user.id, report.id, trackingCode, title, address, damageType, severity);
    
    // Save to session
    await appendMessage(sessionId, user.id, 'SYSTEM', 'Laporan resmi telah dibuat', {
      reportId: report.id,
      trackingCode,
      report
    });
    
    return { success: true, data: { report, trackingCode } };
  });
  
  // Get agent config (for frontend)
  app.get('/config', { preHandler: [app.authenticate] }, async () => {
    const config = getAgentConfig();
    return { success: true, data: { config: { maxSteps: config.maxSteps, tools: config.tools.map(t => t.name) } } };
  });
  
  // Memory stats (for user profile)
  app.get('/memory/stats', { preHandler: [app.authenticate] }, async (request) => {
    const user = (request as any).user;
    const stats = await getMemoryStats(user.id);
    return { success: true, data: { stats } };
  });
  
  // Delete session
  app.delete('/sessions/:sessionId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };
    
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== user.id) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sesi tidak ditemukan', statusCode: 404 } });
    }
    
    await prisma.session.delete({ where: { id: sessionId } });
    
    return { success: true, data: { message: 'Sesi dihapus' } };
  });
};

export default chatRoutes;