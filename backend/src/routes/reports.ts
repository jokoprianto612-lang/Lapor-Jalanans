// Report Routes - CRUD operations for infrastructure reports

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createReport, getReportById, getReportByTrackingCode, getReportsByReporter, getReportsByAssignee, getAllReports, getReportStats, updateReportStatus, assignReport, addProgressUpdate, getPublicTrackingData } from '../services/report.js';
import { analyzeImage, validateImage } from '../services/vision.js';
import { findNearestAuthorities } from '../services/authority.js';
import { generateTrackingCode } from '../services/report.js';
import { runAgent, fallbackRAGQuery } from '../services/agent.js';
import { guardrails } from '../services/guardrails.js';
import { userRateLimit } from '../middleware/auth.js';

import { prisma } from '../lib/db.js';

// ─────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────

const createReportSchema = z.object({
  title: z.string().min(5, 'Judul minimal 5 karakter').max(200),
  description: z.string().min(10, 'Deskripsi minimal 10 karakter').max(2000),
  damageType: z.enum(['POTHOLE', 'CRACK', 'SUBSIDENCE', 'DRAINAGE', 'SIGN_DAMAGE', 'LIGHTING', 'OTHER']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().min(5, 'Alamat minimal 5 karakter').max(500),
  images: z.array(z.string()).min(1, 'Minimal 1 foto').max(5, 'Maksimal 5 foto')
});

const updateStatusSchema = z.object({
  status: z.enum(['SUBMITTED', 'ANALYZING', 'VERIFIED', 'ROUTED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED']),
  message: z.string().min(1, 'Pesan wajib diisi').max(1000),
  images: z.array(z.string()).max(5).optional()
});

const assignSchema = z.object({
  assigneeId: z.string().uuid('ID petugas tidak valid')
});

const progressUpdateSchema = z.object({
  message: z.string().min(1).max(1000),
  images: z.array(z.string()).max(5).optional()
});

const querySchema = z.object({
  status: z.enum(['SUBMITTED', 'ANALYZING', 'VERIFIED', 'ROUTED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED']).optional(),
  damageType: z.enum(['POTHOLE', 'CRACK', 'SUBSIDENCE', 'DRAINAGE', 'SIGN_DAMAGE', 'LIGHTING', 'OTHER']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────

export const reportRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  
  // Create new report (with AI analysis)
  // 10 laporan/menit per user — cegah spam laporan
  app.post('/', { preHandler: [app.authenticate, userRateLimit(10, 60 * 1000)] }, async (request, reply) => {
    const user = (request as any).user;
    const data = createReportSchema.parse(request.body);
    
    // Validate images
    for (const img of data.images) {
      const validation = validateImage(img);
      if (!validation.valid) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_IMAGE', message: validation.error, statusCode: 400 }
        });
      }
    }
    
    // Run AI vision analysis on first image
    let aiAnalysis;
    try {
      aiAnalysis = await analyzeImage(data.images[0], { lat: data.latitude, lng: data.longitude });
    } catch (error) {
      console.error('[Reports] Vision analysis failed:', error);
      // Continue with manual data
      aiAnalysis = {
        damageType: data.damageType,
        severity: data.severity,
        confidence: 0.5,
        details: {
          description: 'Analisis AI gagal, menggunakan input manual',
          estimatedSize: 'Perlu verifikasi',
          estimatedDepth: 'Perlu verifikasi',
          riskFactors: ['Analisis otomatis tidak tersedia'],
          recommendedAction: 'Verifikasi manual di lapangan'
        },
        detectedObjects: []
      };
    }
    
    // Override with AI results if confidence high
    const finalDamageType = aiAnalysis.confidence > 0.7 ? aiAnalysis.damageType : data.damageType;
    const finalSeverity = aiAnalysis.confidence > 0.7 ? aiAnalysis.severity : data.severity;
    
    // Create report
    const trackingCode = generateTrackingCode();
    const report = await createReport({
      ...data,
      damageType: finalDamageType,
      severity: finalSeverity,
      aiAnalysis,
      trackingCode,
      reporterId: user.id
    });
    
    return reply.status(201).send({
      success: true,
      data: { report, aiAnalysis }
    });
  });
  
  // Get my reports
  app.get('/my', { preHandler: [app.authenticate] }, async (request) => {
    const user = (request as any).user;
    const query = querySchema.parse(request.query);
    
    const result = await getReportsByReporter(user.id, {
      status: query.status,
      limit: query.limit,
      offset: query.offset
    });
    
    return { success: true, data: result };
  });
  
  // Get assigned reports (for staff)
  app.get('/assigned', { preHandler: [app.authenticate] }, async (request) => {
    const user = (request as any).user;
    const query = querySchema.parse(request.query);
    
    const result = await getReportsByAssignee(user.id, {
      status: query.status,
      limit: query.limit,
      offset: query.offset
    });
    
    return { success: true, data: result };
  });
  
  // Get single report by ID
  app.get('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };
    
    const report = await getReportById(id);
    if (!report) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Laporan tidak ditemukan', statusCode: 404 } });
    }
    
    // Check access
    const isReporter = report.reporterId === user.id;
    const isAssignee = report.assigneeId === user.id;
    const isAdmin = user.roles.includes('ADMIN');
    const isStaff = user.roles.includes('AUTHORITY_STAFF');
    
    if (!isReporter && !isAssignee && !isAdmin && !isStaff) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Akses ditolak', statusCode: 403 } });
    }
    
    return { success: true, data: { report } };
  });
  
  // Get report by tracking code (public)
  app.get('/track/:trackingCode', async (request, reply) => {
    const { trackingCode } = request.params as { trackingCode: string };
    
    const report = await getPublicTrackingData(trackingCode);
    if (!report) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Kode tracking tidak ditemukan', statusCode: 404 } });
    }
    
    return { success: true, data: { report } };
  });
  
  // Update report status (staff/admin)
  app.patch('/:id/status', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };
    const data = updateStatusSchema.parse(request.body);
    
    // Check authorization
    if (!user.roles.includes('ADMIN') && !user.roles.includes('AUTHORITY_STAFF')) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Hanya petugas yang bisa update status', statusCode: 403 } });
    }
    
    const report = await updateReportStatus(id, user.id, data.status, data.message, data.images);
    if (!report) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Laporan tidak ditemukan', statusCode: 404 } });
    }
    
    return { success: true, data: { report } };
  });
  
  // Assign report to staff (admin)
  app.post('/:id/assign', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };
    const data = assignSchema.parse(request.body);
    
    if (!user.roles.includes('ADMIN')) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Hanya admin yang bisa assign', statusCode: 403 } });
    }
    
    const report = await assignReport(id, data.assigneeId, user.id);
    if (!report) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Laporan tidak ditemukan', statusCode: 404 } });
    }
    
    return { success: true, data: { report } };
  });
  
  // Add progress update
  app.post('/:id/progress', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };
    const data = progressUpdateSchema.parse(request.body);
    
    // Check access
    const report = await getReportById(id);
    if (!report) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Laporan tidak ditemukan', statusCode: 404 } });
    }
    
    const isAssignee = report.assigneeId === user.id;
    const isAdmin = user.roles.includes('ADMIN');
    const isStaff = user.roles.includes('AUTHORITY_STAFF');
    
    if (!isAssignee && !isAdmin && !isStaff) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Hanya petugas yang bisa update progress', statusCode: 403 } });
    }
    
    const updated = await addProgressUpdate(id, user.id, data.message, data.images);
    return { success: true, data: { report: updated } };
  });
  
  // Get nearby authorities for location
  app.post('/authorities/nearby', { preHandler: [app.authenticate] }, async (request) => {
    const { latitude, longitude, damageType } = request.body as { latitude: number; longitude: number; damageType: string };
    
    const authorities = await findNearestAuthorities(latitude, longitude, damageType as any, 5);
    
    return { success: true, data: { authorities } };
  });
  
  // Analyze image only (preview before submit)
  app.post('/analyze-image', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { image, latitude, longitude } = request.body as { image: string; latitude?: number; longitude?: number };
    
    if (!image) {
      return reply.status(400).send({ success: false, error: { code: 'MISSING_IMAGE', message: 'Gambar wajib dikirim', statusCode: 400 } });
    }
    
    const validation = validateImage(image);
    if (!validation.valid) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_IMAGE', message: validation.error, statusCode: 400 } });
    }
    
    const analysis = await analyzeImage(image, latitude && longitude ? { lat: latitude, lng: longitude } : undefined);
    
    return { success: true, data: { analysis } };
  });
};

export default reportRoutes;