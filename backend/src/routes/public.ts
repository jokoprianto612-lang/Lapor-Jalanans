// Public Routes - No authentication required

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getReportByTrackingCode, getPublicTrackingData } from '../services/report.js';
import { findNearestAuthorities, getAuthorityById, getAuthoritiesByType, formatAuthorityContact } from '../services/authority.js';
import { ragQuery, getCategories, getDocumentsByCategory } from '../services/rag.js';

import { prisma } from '../lib/db.js';

// ─────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────

const trackSchema = z.object({
  trackingCode: z.string().min(1)
});

const nearbyAuthSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  damageType: z.enum(['POTHOLE', 'CRACK', 'SUBSIDENCE', 'DRAINAGE', 'SIGN_DAMAGE', 'LIGHTING', 'OTHER']).optional(),
  limit: z.coerce.number().min(1).max(10).default(5)
});

const ragQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().min(1).max(20).default(5)
});

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────

export const publicRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  
  // Track report by tracking code (public)
  app.get('/track/:trackingCode', async (request, reply) => {
    const { trackingCode } = request.params as { trackingCode: string };
    
    const report = await getPublicTrackingData(trackingCode);
    if (!report) {
      return reply.status(404).send({ 
        success: false, 
        error: { code: 'NOT_FOUND', message: 'Kode tracking tidak ditemukan', statusCode: 404 } 
      });
    }
    
    return { success: true, data: { report } };
  });
  
  // Find nearby authorities (public - for emergency/quick lookup)
  app.post('/authorities/nearby', async (request) => {
    const data = nearbyAuthSchema.parse(request.body);
    
    const authorities = await findNearestAuthorities(
      data.latitude,
      data.longitude,
      data.damageType || 'OTHER',
      data.limit
    );
    
    return {
      success: true,
      data: {
        authorities: authorities.map(a => ({
          name: a.authority.name,
          type: a.authority.type,
          distance: a.distance,
          isWithinRadius: a.isWithinRadius,
          address: a.authority.address,
          contactPerson: a.authority.contactPerson,
          phone: a.authority.phone,
          whatsapp: a.authority.whatsapp,
          email: a.authority.email,
          contactInfo: formatAuthorityContact(a.authority)
        }))
      }
    };
  });
  
  // Get authority details (public)
  app.get('/authorities/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const authority = await getAuthorityById(id);
    if (!authority) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Instansi tidak ditemukan', statusCode: 404 } });
    }
    
    return {
      success: true,
      data: {
        authority: {
          id: authority.id,
          name: authority.name,
          type: authority.type,
          address: authority.address,
          contactPerson: authority.contactPerson,
          phone: authority.phone,
          whatsapp: authority.whatsapp,
          email: authority.email,
          radius: authority.radius
        },
        contactInfo: formatAuthorityContact(authority)
      }
    };
  });
  
  // Get authorities by type (public)
  app.get('/authorities/type/:type', async (request) => {
    const { type } = request.params as { type: string };
    
    const authorities = await getAuthoritiesByType(type as any);
    
    return { success: true, data: { authorities } };
  });
  
  // Knowledge base search (public)
  app.get('/knowledge/search', async (request) => {
    const query = ragQuerySchema.parse(request.query);
    
    const results = await ragQuery(query.q, query.limit);
    
    return { success: true, data: { results } };
  });
  
  // Get knowledge base categories
  app.get('/knowledge/categories', async () => {
    const categories = getCategories();
    
    return { success: true, data: { categories } };
  });
  
  // Get knowledge base documents by category
  app.get('/knowledge/category/:category', async (request) => {
    const { category } = request.params as { category: string };
    
    const documents = getDocumentsByCategory(category);
    
    return { success: true, data: { documents } };
  });
  
  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    service: 'lapor-jalan-api',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  }));
  
  // App info
  app.get('/info', async () => ({
    name: 'Lapor Jalan',
    description: 'Sistem Pelaporan Kerusakan Infrastruktur Jalan Berbasis AI',
    version: '1.0.0',
    features: [
      'AI Vision Analysis untuk deteksi kerusakan',
      'Chat bot conversational untuk pelaporan',
      'Routing otomatis ke instansi berwenang',
      'Notifikasi WhatsApp/Email/SMS',
      'Tracking real-time dengan QR code',
      'PWA untuk offline reporting'
    ],
    damageTypes: [
      { value: 'POTHOLE', label: 'Lubang (Pothole)' },
      { value: 'CRACK', label: 'Retak (Crack)' },
      { value: 'SUBSIDENCE', label: 'Longsor/Subsidence' },
      { value: 'DRAINAGE', label: 'Masalah Drainase' },
      { value: 'SIGN_DAMAGE', label: 'Kerusakan Rambu' },
      { value: 'LIGHTING', label: 'Kerusakan Lampu Jalan' },
      { value: 'OTHER', label: 'Lainnya' }
    ],
    severityLevels: [
      { value: 'LOW', label: 'Ringan', color: '#22c55e' },
      { value: 'MEDIUM', label: 'Sedang', color: '#f59e0b' },
      { value: 'HIGH', label: 'Berat', color: '#ef4444' },
      { value: 'CRITICAL', label: 'Darurat', color: '#991b1b' }
    ],
    statuses: [
      { value: 'SUBMITTED', label: 'Dikirim' },
      { value: 'ANALYZING', label: 'Dianalisis AI' },
      { value: 'VERIFIED', label: 'Diverifikasi' },
      { value: 'ROUTED', label: 'Diteruskan ke Instansi' },
      { value: 'IN_PROGRESS', label: 'Sedang Dikerjakan' },
      { value: 'RESOLVED', label: 'Selesai' },
      { value: 'REJECTED', label: 'Ditolak' },
      { value: 'CLOSED', label: 'Ditutup' }
    ]
  }));
};

export default publicRoutes;