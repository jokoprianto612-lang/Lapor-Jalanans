// Admin Routes - System administration, analytics, user management

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getReportStats } from '../services/report.js';
import { getMemoryStats } from '../services/memory.js';
import { computeMetrics, getRecentTraces, getGuardrailDistribution, getTraceStoreStats, exportTraces } from '../services/observability.js';
import { seedAuthorities } from '../services/authority.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import type { Prisma } from '@prisma/client';

import { prisma } from '../lib/db.js';

// ─────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────

const statsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  userId: z.string().uuid().optional()
});

const userQuerySchema = z.object({
  role: z.enum(['CITIZEN', 'ADMIN', 'AUTHORITY_STAFF']).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().optional()
});

const updateUserRoleSchema = z.object({
  role: z.enum(['CITIZEN', 'ADMIN', 'AUTHORITY_STAFF']),
  authorityId: z.string().uuid().optional()
});

const systemConfigSchema = z.object({
  key: z.string().min(1),
  // z.any() di-zod di-infer jadi optional → Prisma nolak create tanpa value.
  // z.custom<Prisma.InputJsonValue>: type tidak mengandung undefined → wajib ada,
  // dan cocok dengan tipe Json Prisma (null ditolak — kolom value tidak nullable).
  value: z.custom<Prisma.InputJsonValue>((v) => v !== undefined && v !== null, { message: 'value wajib diisi' }),
  description: z.string().optional()
});

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────

export const adminRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  
  // All admin routes: authenticate DULU (mengisi request.user), baru cek role.
  // Dulu hanya requireAdmin tanpa authenticate → request.user selalu kosong → 401 semua.
  app.addHook('preHandler', async (request, reply) => {
    await authenticate(request, reply);
    if (reply.sent) return;
    await requireAdmin(request, reply);
  });
  
  // ─────────────────────────────────────────────
  // Dashboard Stats
  // ─────────────────────────────────────────────
  
  app.get('/dashboard', async (request) => {
    const query = statsQuerySchema.parse(request.query);
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;
    
    const [reportStats, userCount, sessionCount, aiMetrics] = await Promise.all([
      getReportStats(query.userId, startDate, endDate),
      prisma.user.count(),
      prisma.session.count(),
      computeMetrics()
    ]);
    
    return {
      success: true,
      data: {
        reports: reportStats,
        users: { total: userCount },
        sessions: { total: sessionCount },
        ai: aiMetrics,
        period: { startDate, endDate }
      }
    };
  });
  
  // ─────────────────────────────────────────────
  // User Management
  // ─────────────────────────────────────────────
  
  app.get('/users', async (request) => {
    const query = userQuerySchema.parse(request.query);
    
    const where: any = {};
    if (query.role) where.role = query.role;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } }
      ];
    }
    
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
        select: {
          id: true, email: true, name: true, phone: true, avatar: true,
          role: true, authorityId: true, createdAt: true,
          _count: { select: { reports: true, sessions: true, notifications: true } }
        }
      }),
      prisma.user.count({ where })
    ]);
    
    return {
      success: true,
      data: { users, total, pagination: { limit: query.limit, offset: query.offset, total } }
    };
  });
  
  app.get('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, name: true, phone: true, avatar: true,
        role: true, authorityId: true, createdAt: true, updatedAt: true,
        _count: { select: { reports: true, sessions: true, notifications: true } },
        reports: { take: 5, orderBy: { submittedAt: 'desc' }, select: { id: true, trackingCode: true, title: true, status: true, submittedAt: true } },
        sessions: { take: 5, orderBy: { updatedAt: 'desc' }, select: { id: true, title: true, _count: { select: { messages: true } }, updatedAt: true } }
      }
    });
    
    if (!user) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User tidak ditemukan', statusCode: 404 } });
    }
    
    return { success: true, data: { user } };
  });
  
  app.patch('/users/:id/role', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updateUserRoleSchema.parse(request.body);
    
    const user = await prisma.user.update({
      where: { id },
      data: { role: data.role, authorityId: data.authorityId || null },
      select: { id: true, email: true, name: true, role: true, authorityId: true }
    });
    
    return { success: true, data: { user } };
  });
  
  // ─────────────────────────────────────────────
  // Report Management (Admin view)
  // ─────────────────────────────────────────────
  
  app.get('/reports', async (request) => {
    const query = z.object({
      status: z.enum(['SUBMITTED', 'ANALYZING', 'VERIFIED', 'ROUTED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED']).optional(),
      damageType: z.enum(['POTHOLE', 'CRACK', 'SUBSIDENCE', 'DRAINAGE', 'SIGN_DAMAGE', 'LIGHTING', 'OTHER']).optional(),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
      limit: z.coerce.number().min(1).max(100).default(50),
      offset: z.coerce.number().min(0).default(0),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional()
    }).parse(request.query);
    
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.damageType) where.damageType = query.damageType;
    if (query.severity) where.severity = query.severity;
    if (query.startDate || query.endDate) {
      where.submittedAt = {};
      if (query.startDate) where.submittedAt.gte = new Date(query.startDate);
      if (query.endDate) where.submittedAt.lte = new Date(query.endDate);
    }
    
    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        take: query.limit,
        skip: query.offset,
        include: {
          reporter: { select: { id: true, name: true, phone: true, email: true } },
          assignee: { select: { id: true, name: true } },
          updates: { orderBy: { createdAt: 'desc' }, take: 1 }
        }
      }),
      prisma.report.count({ where })
    ]);
    
    return {
      success: true,
      data: { reports, total, pagination: { limit: query.limit, offset: query.offset, total } }
    };
  });
  
  app.patch('/reports/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = z.object({
      status: z.enum(['SUBMITTED', 'ANALYZING', 'VERIFIED', 'ROUTED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED']),
      message: z.string().min(1).max(1000)
    }).parse(request.body);
    
    const report = await prisma.report.update({
      where: { id },
      data: { status: data.status },
      include: { reporter: true, assignee: true }
    });
    
    await prisma.reportUpdate.create({
      data: { reportId: id, authorId: (request as any).user.id, status: data.status, message: data.message }
    });
    
    return { success: true, data: { report } };
  });
  
  // ─────────────────────────────────────────────
  // AI Observability
  // ─────────────────────────────────────────────
  
  app.get('/observability/metrics', async (request) => {
    const { window = '24h' } = request.query as { window?: string };
    
    const windowMs = parseWindow(window);
    const metrics = computeMetrics(windowMs);
    
    return { success: true, data: { metrics, window } };
  });
  
  app.get('/observability/traces', async (request) => {
    const { limit = 50, sessionId } = request.query as { limit?: number; sessionId?: string };
    
    const traces = getRecentTraces(limit, sessionId);
    
    return { success: true, data: { traces } };
  });
  
  app.get('/observability/guardrails', async () => {
    const distribution = getGuardrailDistribution();
    
    return { success: true, data: { distribution } };
  });
  
  app.get('/observability/stats', async () => {
    const stats = getTraceStoreStats();
    
    return { success: true, data: { stats } };
  });
  
  app.get('/observability/export', async (request, reply) => {
    const { sessionId } = request.query as { sessionId?: string };
    
    const json = exportTraces(sessionId);
    
    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="traces-${sessionId || 'all'}-${Date.now()}.json"`);
    
    return reply.send(json);
  });
  
  // ─────────────────────────────────────────────
  // Memory Management
  // ─────────────────────────────────────────────
  
  app.get('/memory/stats', async (request) => {
    const { userId } = request.query as { userId?: string };
    
    const stats = await getMemoryStats(userId);
    
    return { success: true, data: { stats } };
  });
  
  // ─────────────────────────────────────────────
  // System Configuration
  // ─────────────────────────────────────────────
  
  app.get('/config', async () => {
    const configs = await prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
    
    return { success: true, data: { configs } };
  });
  
  app.post('/config', async (request) => {
    const data = systemConfigSchema.parse(request.body);
    
    const config = await prisma.systemConfig.upsert({
      where: { key: data.key },
      update: { value: data.value, description: data.description },
      create: data
    });
    
    return { success: true, data: { config } };
  });
  
  app.delete('/config/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    
    await prisma.systemConfig.delete({ where: { key } }).catch(() => {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Config tidak ditemukan', statusCode: 404 } });
    });
    
    return { success: true, data: { message: 'Config dihapus' } };
  });
  
  // ─────────────────────────────────────────────
  // Maintenance
  // ─────────────────────────────────────────────
  
  app.post('/maintenance/seed-authorities', async () => {
    await seedAuthorities();
    return { success: true, data: { message: 'Authorities seeded' } };
  });
  
  app.post('/maintenance/cleanup-old-sessions', async () => {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days
    
    const deleted = await prisma.session.deleteMany({
      where: { updatedAt: { lt: cutoff } }
    });
    
    return { success: true, data: { deletedSessions: deleted.count } };
  });
  
  app.post('/maintenance/cleanup-old-traces', async () => {
    // In-memory traces are auto-cleaned by cap
    // This would clean DB audit logs
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const deleted = await prisma.auditLog.deleteMany({
      where: { action: 'AI_TRACE', createdAt: { lt: cutoff } }
    });
    
    return { success: true, data: { deletedTraces: deleted.count } };
  });
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function parseWindow(window: string): number {
  const match = window.match(/^(\d+)([hmd])$/);
  if (!match) return 24 * 60 * 60 * 1000;
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'm': return value * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}

export default adminRoutes;