// Authority Routes - Authority management and lookup

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { findNearestAuthorities, getAuthorityById, getAuthoritiesByType, searchAuthorities, getAuthoritiesInRadius, formatAuthorityContact, generateWhatsAppLink, generateEmailLink, getAdministrativeBoundary } from '../services/authority.js';

import { prisma } from '../lib/db.js';

// ─────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────

const nearbySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  damageType: z.enum(['POTHOLE', 'CRACK', 'SUBSIDENCE', 'DRAINAGE', 'SIGN_DAMAGE', 'LIGHTING', 'OTHER']).optional(),
  limit: z.coerce.number().min(1).max(20).default(5)
});

const radiusSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z.coerce.number().min(100).max(100000).default(10000)
});

const searchSchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().min(1).max(50).default(20)
});

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────

export const authorityRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  
  // Find nearest authorities for a location
  app.post('/nearby', { preHandler: [app.authenticate] }, async (request) => {
    const data = nearbySchema.parse(request.body);
    
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
          authority: a.authority,
          distance: a.distance,
          isWithinRadius: a.isWithinRadius,
          contactInfo: formatAuthorityContact(a.authority),
          whatsappLink: a.authority.whatsapp ? generateWhatsAppLink(a.authority.whatsapp, `Laporan kerusakan jalan di area ${a.authority.name}`) : null,
          emailLink: a.authority.email ? generateEmailLink(a.authority.email, 'Laporan Kerusakan Jalan', `Detail laporan...`) : null
        }))
      }
    };
  });
  
  // Get authorities within radius
  app.post('/in-radius', { preHandler: [app.authenticate] }, async (request) => {
    const data = radiusSchema.parse(request.body);
    
    const authorities = await getAuthoritiesInRadius(data.latitude, data.longitude, data.radius);
    
    return {
      success: true,
      data: { authorities }
    };
  });
  
  // Get authority by ID
  app.get('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const authority = await getAuthorityById(id);
    if (!authority) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Instansi tidak ditemukan', statusCode: 404 } });
    }
    
    return {
      success: true,
      data: {
        authority,
        contactInfo: formatAuthorityContact(authority),
        whatsappLink: authority.whatsapp ? generateWhatsAppLink(authority.whatsapp, '') : null,
        emailLink: authority.email ? generateEmailLink(authority.email, '', '') : null
      }
    };
  });
  
  // Get authorities by type
  app.get('/type/:type', { preHandler: [app.authenticate] }, async (request) => {
    const { type } = request.params as { type: string };
    
    const authorities = await getAuthoritiesByType(type as any);
    
    return { success: true, data: { authorities } };
  });
  
  // Search authorities
  app.get('/search', { preHandler: [app.authenticate] }, async (request) => {
    const query = searchSchema.parse(request.query);
    
    const authorities = await searchAuthorities(query.q);
    
    return { success: true, data: { authorities: authorities.slice(0, query.limit) } };
  });
  
  // Get all authority types
  app.get('/types', { preHandler: [app.authenticate] }, async () => {
    const types = [
      { value: 'RT', label: 'RT (Rukun Tetangga)', description: 'Tingkat terkecil, lingkungan langsung' },
      { value: 'RW', label: 'RW (Rukun Warga)', description: 'Beberapa RT, koordinasi lingkungan' },
      { value: 'KELURAHAN', label: 'Kelurahan/Desa', description: 'Pemerintah desa/kelurahan' },
      { value: 'KECAMATAN', label: 'Kecamatan', description: 'Pemerintah kecamatan' },
      { value: 'DINAS_PU', label: 'Dinas Pekerjaan Umum', description: 'Bidang pekerjaan umum & tata ruang' },
      { value: 'DINAS_BINA_MARGA', label: 'Dinas Bina Marga', description: 'Khusus jalan & jembatan' },
      { value: 'POLISI', label: 'Polisi (Ditlantas)', description: 'Lalu lintas & keamanan jalan' },
      { value: 'PLN', label: 'PLN', description: 'Listrik & lampu jalan (PJU)' },
      { value: 'PDAM', label: 'PDAM', description: 'Air bersih & drainase' },
      { value: 'TELKOM', label: 'Telkom/ISP', description: 'Telekomunikasi & kabel' },
      { value: 'OTHER', label: 'Lainnya', description: 'Instansi lain' }
    ];
    
    return { success: true, data: { types } };
  });
  
  // Get administrative boundary for location
  app.post('/boundary', { preHandler: [app.authenticate] }, async (request) => {
    const { latitude, longitude } = request.body as { latitude: number; longitude: number };
    
    if (!latitude || !longitude) {
      return { success: false, error: { code: 'MISSING_COORDS', message: 'Koordinat wajib dikirim', statusCode: 400 } };
    }
    
    const boundary = await getAdministrativeBoundary(latitude, longitude);
    
    return { success: true, data: { boundary } };
  });
  
  // Get contact links for authority
  app.get('/:id/contact-links', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { message, reportUrl } = request.query as { message?: string; reportUrl?: string };
    
    const authority = await getAuthorityById(id);
    if (!authority) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Instansi tidak ditemukan', statusCode: 404 } });
    }
    
    const defaultMsg = message || `Laporan kerusakan jalan di wilayah ${authority.name}. Detail: ${reportUrl || ''}`;
    
    return {
      success: true,
      data: {
        whatsapp: authority.whatsapp ? generateWhatsAppLink(authority.whatsapp, defaultMsg) : null,
        email: authority.email ? generateEmailLink(authority.email, 'Laporan Kerusakan Jalan', defaultMsg) : null,
        phone: authority.phone ? `tel:${authority.phone}` : null
      }
    };
  });
};

export default authorityRoutes;