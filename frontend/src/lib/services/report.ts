// Report Service - Core report management
// Create, update, track, and manage infrastructure reports

import type { ReportCreateInput, ReportResponse, ReportStatus, AIVisionAnalysis, DamageType, Severity } from '../types/index';
import { v4 as uuidv4 } from 'uuid';
import * as QRCode from 'qrcode';
import { findNearestAuthorities, formatAuthorityContact, generateWhatsAppLink } from './authority';
import { sendNotification } from './notification';
import { appendMessage } from './memory';
import { recordTrace } from './observability';

import { prisma } from '../db';

// ─────────────────────────────────────────────
// Report Creation
// ─────────────────────────────────────────────

/**
 * Create a new infrastructure report
 */
export async function createReport(data: ReportCreateInput & { 
  aiAnalysis?: AIVisionAnalysis | null; 
  trackingCode: string;
  reporterId: string;
}): Promise<ReportResponse> {
  // Find best authority for this location and damage type
  const bestAuthority = await findNearestAuthorities(
    data.latitude,
    data.longitude,
    data.damageType,
    1
  );
  
  const authority = bestAuthority?.[0]?.authority;
  
  // Generate QR code for tracking
  const trackingUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/track/${data.trackingCode}`;
  const qrCode = await QRCode.toDataURL(trackingUrl);
  
  // Create report in database
  const report = await prisma.report.create({
    data: {
      reporterId: data.reporterId,
      authorityType: authority?.type || 'KECAMATAN',
      authorityName: authority?.name || 'Kecamatan Setempat',
      authorityContact: authority?.whatsapp || authority?.phone || authority?.email || null,
      title: data.title,
      description: data.description,
      damageType: data.damageType,
      severity: data.severity,
      latitude: data.latitude,
      longitude: data.longitude,
      address: data.address,
      images: data.images,
      aiAnalysis: (data.aiAnalysis ?? null) as any,
      aiConfidence: data.aiAnalysis?.confidence ?? null,
      trackingCode: data.trackingCode,
      qrCode,
      status: 'SUBMITTED'
    }
  });
  
  // Create initial update
  await prisma.reportUpdate.create({
    data: {
      reportId: report.id,
      authorId: data.reporterId,
      status: 'SUBMITTED',
      message: 'Laporan diterima dan sedang diproses'
    }
  });
  
  // Notify reporter
  await sendNotification({
    userId: data.reporterId,
    reportId: report.id,
    type: 'WHATSAPP',
    title: 'Laporan Diterima',
    message: `Laporan Anda berhasil dikirim! Kode tracking: ${data.trackingCode}. Status: SUBMITTED`
  });
  
  // Notify authority if contact available
  if (authority) {
    await sendNotification({
      userId: data.reporterId, // Using reporter as proxy for now
      authorityId: authority.id,
      reportId: report.id,
      type: 'WHATSAPP',
      title: 'Laporan Baru',
      message: `LAPORAN BARU: ${data.title} di ${data.address}. Jenis: ${data.damageType}, Keparahan: ${data.severity}. Kode: ${data.trackingCode}. Detail: ${trackingUrl}`
    });
  }
  
  // Log to memory for context
  await appendMessage(
    `session-${data.reporterId}`,
    data.reporterId,
    'SYSTEM',
    `Laporan dibuat: ${data.trackingCode} - ${data.title}`,
    { reportId: report.id, trackingCode: data.trackingCode }
  );
  
  return mapReportToResponse(report);
}

/**
 * Generate unique tracking code
 */
export function generateTrackingCode(): string {
  const prefix = 'LJR';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// ─────────────────────────────────────────────
// Report Queries
// ─────────────────────────────────────────────

/**
 * Get report by ID
 */
export async function getReportById(id: string): Promise<ReportResponse | null> {
  const report = await prisma.report.findUnique({
    where: { id },
    include: { 
      updates: { orderBy: { createdAt: 'desc' } },
      reporter: true,
      assignee: true
    }
  });
  return report ? mapReportToResponse(report) : null;
}

/**
 * Get report by tracking code
 */
export async function getReportByTrackingCode(trackingCode: string): Promise<ReportResponse | null> {
  const report = await prisma.report.findUnique({
    where: { trackingCode },
    include: { 
      updates: { orderBy: { createdAt: 'desc' } },
      reporter: true,
      assignee: true
    }
  });
  return report ? mapReportToResponse(report) : null;
}

/**
 * Get reports by reporter
 */
export async function getReportsByReporter(
  reporterId: string, 
  options: { status?: ReportStatus; limit?: number; offset?: number } = {}
): Promise<{ reports: ReportResponse[]; total: number }> {
  const where: any = { reporterId };
  if (options.status) where.status = options.status;
  
  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      take: options.limit || 20,
      skip: options.offset || 0,
      include: { updates: { orderBy: { createdAt: 'desc' }, take: 1 } }
    }),
    prisma.report.count({ where })
  ]);
  
  return {
    reports: reports.map(mapReportToResponse),
    total
  };
}

/**
 * Get reports assigned to authority staff
 */
export async function getReportsByAssignee(
  assigneeId: string,
  options: { status?: ReportStatus; limit?: number; offset?: number } = {}
): Promise<{ reports: ReportResponse[]; total: number }> {
  const where: any = { assigneeId };
  if (options.status) where.status = options.status;
  
  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      take: options.limit || 20,
      skip: options.offset || 0,
      include: { updates: { orderBy: { createdAt: 'desc' }, take: 1 } }
    }),
    prisma.report.count({ where })
  ]);
  
  return {
    reports: reports.map(mapReportToResponse),
    total
  };
}

/**
 * Get all reports (admin)
 */
export async function getAllReports(
  options: { 
    status?: ReportStatus; 
    damageType?: DamageType;
    severity?: Severity;
    limit?: number; 
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{ reports: ReportResponse[]; total: number }> {
  const where: any = {};
  if (options.status) where.status = options.status;
  if (options.damageType) where.damageType = options.damageType;
  if (options.severity) where.severity = options.severity;
  if (options.startDate || options.endDate) {
    where.submittedAt = {};
    if (options.startDate) where.submittedAt.gte = options.startDate;
    if (options.endDate) where.submittedAt.lte = options.endDate;
  }
  
  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      take: options.limit || 50,
      skip: options.offset || 0,
      include: { 
        updates: { orderBy: { createdAt: 'desc' }, take: 1 },
        reporter: { select: { id: true, name: true, phone: true } },
        assignee: { select: { id: true, name: true } }
      }
    }),
    prisma.report.count({ where })
  ]);
  
  return {
    reports: reports.map(mapReportToResponse),
    total
  };
}

/**
 * Get report statistics
 */
export async function getReportStats(
  userId?: string,
  startDate?: Date,
  endDate?: Date
) {
  const where: any = {};
  if (userId) where.reporterId = userId;
  if (startDate || endDate) {
    where.submittedAt = {};
    if (startDate) where.submittedAt.gte = startDate;
    if (endDate) where.submittedAt.lte = endDate;
  }
  
  const [byStatus, byDamageType, bySeverity, total, recentResolved] = await Promise.all([
    prisma.report.groupBy({ by: ['status'], where, _count: true }),
    prisma.report.groupBy({ by: ['damageType'], where, _count: true }),
    prisma.report.groupBy({ by: ['severity'], where, _count: true }),
    prisma.report.count({ where }),
    // Prisma tidak bisa AVG kolom DateTime → ambil sampel laporan selesai
    // terbaru (500) dan hitung rata-rata durasi di aplikasi.
    prisma.report.findMany({
      where: { ...where, resolvedAt: { not: null } },
      select: { submittedAt: true, resolvedAt: true },
      orderBy: { resolvedAt: 'desc' },
      take: 500
    })
  ]);

  // Durasi = resolvedAt - submittedAt (rumus lama memakai Date.now() → selalu negatif)
  const totalResolvedMs = recentResolved.reduce(
    (sum, r) => sum + (r.resolvedAt ? r.resolvedAt.getTime() - r.submittedAt.getTime() : 0),
    0
  );
  
  return {
    total,
    byStatus: byStatus.map((s: { status: string; _count: number }) => ({ status: s.status, count: s._count })),
    byDamageType: byDamageType.map((d: { damageType: string; _count: number }) => ({ damageType: d.damageType, count: d._count })),
    bySeverity: bySeverity.map((s: { severity: string; _count: number }) => ({ severity: s.severity, count: s._count })),
    avgResolutionTimeHours: recentResolved.length
      ? totalResolvedMs / recentResolved.length / (1000 * 60 * 60)
      : null
  };
}

// ─────────────────────────────────────────────
// Report Updates
// ─────────────────────────────────────────────

/**
 * Update report status (by authority staff or admin)
 */
export async function updateReportStatus(
  reportId: string,
  authorId: string,
  newStatus: ReportStatus,
  message: string,
  images: string[] = []
): Promise<ReportResponse | null> {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) return null;
  
  const oldStatus = report.status;
  
  // Update report
  const updateData: any = { status: newStatus };
  
  // Set timestamps based on status
  if (newStatus === 'VERIFIED' && oldStatus === 'SUBMITTED') {
    updateData.verifiedAt = new Date();
  } else if (newStatus === 'ROUTED' && oldStatus === 'VERIFIED') {
    updateData.routedAt = new Date();
  } else if (newStatus === 'IN_PROGRESS' && oldStatus === 'ROUTED') {
    // Already has routedAt
  } else if (newStatus === 'RESOLVED') {
    updateData.resolvedAt = new Date();
  } else if (newStatus === 'CLOSED') {
    updateData.closedAt = new Date();
  }
  
  const updated = await prisma.report.update({
    where: { id: reportId },
    data: updateData,
    include: { updates: { orderBy: { createdAt: 'desc' } } }
  });
  
  // Create update record
  await prisma.reportUpdate.create({
    data: {
      reportId,
      authorId,
      status: newStatus,
      message,
      images
    }
  });
  
  // Notify reporter
  await sendNotification({
    userId: report.reporterId,
    reportId,
    type: 'WHATSAPP',
    title: 'Update Laporan',
    message: `Update laporan ${report.trackingCode}: Status berubah dari ${oldStatus} ke ${newStatus}. ${message}`
  });
  
  // Notify assignee if different
  if (report.assigneeId && report.assigneeId !== authorId) {
    await sendNotification({
      userId: report.assigneeId,
      reportId,
      type: 'PUSH',
      title: 'Update Laporan',
      message: `Laporan ${report.trackingCode} diupdate: ${newStatus} - ${message}`
    });
  }
  
  return mapReportToResponse(updated);
}

/**
 * Assign report to authority staff
 */
export async function assignReport(reportId: string, assigneeId: string, assignedBy: string): Promise<ReportResponse | null> {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) return null;
  
  const updated = await prisma.report.update({
    where: { id: reportId },
    data: { 
      assigneeId,
      status: 'ROUTED',
      routedAt: new Date()
    },
    include: { updates: { orderBy: { createdAt: 'desc' } } }
  });
  
  // Create update
  await prisma.reportUpdate.create({
    data: {
      reportId,
      authorId: assignedBy,
      status: 'ROUTED',
      message: `Ditugaskan ke petugas`
    }
  });
  
  // Notify assignee
  await sendNotification({
    userId: assigneeId,
    reportId,
    type: 'WHATSAPP',
    title: 'Tugas Baru',
    message: `Anda ditugaskan handle laporan ${report.trackingCode}: ${report.title} di ${report.address}`
  });
  
  // Notify reporter
  await sendNotification({
    userId: report.reporterId,
    reportId,
    type: 'WHATSAPP',
    title: 'Laporan Ditugaskan',
    message: `Laporan ${report.trackingCode} telah ditugaskan ke petugas. Status: ROUTED`
  });
  
  return mapReportToResponse(updated);
}

/**
 * Add progress update (photos, notes)
 */
export async function addProgressUpdate(
  reportId: string,
  authorId: string,
  message: string,
  images: string[] = []
): Promise<ReportResponse | null> {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) return null;
  
  await prisma.reportUpdate.create({
    data: {
      reportId,
      authorId,
      status: report.status,
      message,
      images
    }
  });
  
  // Notify reporter
  await sendNotification({
    userId: report.reporterId,
    reportId,
    type: 'PUSH',
    title: 'Progress Update',
    message: `Progress update pada laporan ${report.trackingCode}: ${message}`
  });
  
  return getReportById(reportId);
}

// ─────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────

function mapReportToResponse(report: any): ReportResponse {
  return {
    id: report.id,
    trackingCode: report.trackingCode,
    title: report.title,
    description: report.description,
    damageType: report.damageType,
    severity: report.severity,
    status: report.status,
    latitude: report.latitude,
    longitude: report.longitude,
    address: report.address,
    images: report.images,
    aiAnalysis: report.aiAnalysis,
    aiConfidence: report.aiConfidence,
    qrCode: report.qrCode,
    authorityName: report.authorityName,
    authorityContact: report.authorityContact,
    submittedAt: report.submittedAt,
    verifiedAt: report.verifiedAt,
    routedAt: report.routedAt,
    resolvedAt: report.resolvedAt,
    closedAt: report.closedAt
  };
}

/**
 * Generate public tracking page data
 */
export async function getPublicTrackingData(trackingCode: string) {
  const report = await getReportByTrackingCode(trackingCode);
  if (!report) return null;
  
  // Return limited public info
  return {
    trackingCode: report.trackingCode,
    title: report.title,
    damageType: report.damageType,
    severity: report.severity,
    status: report.status,
    address: report.address,
    submittedAt: report.submittedAt,
    verifiedAt: report.verifiedAt,
    routedAt: report.routedAt,
    resolvedAt: report.resolvedAt,
    authorityName: report.authorityName,
    qrCode: report.qrCode,
    updates: report.updates?.map((u: { status: string; message: string; images: string[]; createdAt: Date }) => ({
      status: u.status,
      message: u.message,
      createdAt: u.createdAt,
      images: u.images
    })) || []
  };
}