// Authority Service - Geospatial Routing to Appropriate Authorities
// Find nearest authorities based on location and damage type

import type { Authority, AuthorityMatch, AuthorityType, DamageType } from '../types/index';
import * as geolib from 'geolib';

import { prisma } from '../db';

// ─────────────────────────────────────────────
// Authority Type Mapping by Damage Type
// ─────────────────────────────────────────────

const DAMAGE_AUTHORITY_PRIORITY: Record<DamageType, AuthorityType[]> = {
  POTHOLE: ['DINAS_BINA_MARGA', 'DINAS_PU', 'KECAMATAN', 'KELURAHAN', 'RT', 'RW'],
  CRACK: ['DINAS_BINA_MARGA', 'DINAS_PU', 'KECAMATAN', 'KELURAHAN', 'RT', 'RW'],
  SUBSIDENCE: ['DINAS_BINA_MARGA', 'DINAS_PU', 'BPBD', 'KECAMATAN', 'POLISI'],
  DRAINAGE: ['DINAS_PU', 'DINAS_CIPTA_KARYA', 'KECAMATAN', 'KELURAHAN', 'PDAM'],
  SIGN_DAMAGE: ['DINAS_PERHUBUNGAN', 'POLISI', 'DINAS_BINA_MARGA', 'KECAMATAN'],
  LIGHTING: ['PLN', 'DINAS_PU', 'KECAMATAN', 'KELURAHAN'],
  OTHER: ['KECAMATAN', 'KELURAHAN', 'DINAS_PU', 'RT', 'RW']
};

// Extended authority types for mapping
type ExtendedAuthorityType = AuthorityType | 'DINAS_CIPTA_KARYA' | 'DINAS_PERHUBUNGAN' | 'BPBD';

// ─────────────────────────────────────────────
// Default Authority Data (seeded)
// ─────────────────────────────────────────────

const DEFAULT_AUTHORITIES: Omit<Authority, 'id'>[] = [
  // RT Level (smallest radius)
  { name: 'RT 001/RW 001 Kelurahan Menteng', type: 'RT', email: null, phone: '081234567001', whatsapp: '6281234567001', address: 'Jl. Menteng Raya No. 1', latitude: -6.1944, longitude: 106.8229, radius: 1000, isActive: true, contactPerson: 'Pak Budi (Ketua RT)' },
  { name: 'RT 002/RW 001 Kelurahan Menteng', type: 'RT', email: null, phone: '081234567002', whatsapp: '6281234567002', address: 'Jl. Teuku Umar No. 10', latitude: -6.1901, longitude: 106.8185, radius: 1000, isActive: true, contactPerson: 'Ibu Siti (Ketua RT)' },
  { name: 'RT 003/RW 002 Kelurahan Kuningan', type: 'RT', email: null, phone: '081234567003', whatsapp: '6281234567003', address: 'Jl. HR Rasuna Said', latitude: -6.2205, longitude: 106.8332, radius: 1000, isActive: true, contactPerson: 'Pak Joko (Ketua RT)' },
  
  // RW Level
  { name: 'RW 001 Kelurahan Menteng', type: 'RW', email: 'rw001.menteng@kelurahan.go.id', phone: '0213901234', whatsapp: '6281234567010', address: 'Kantor Kelurahan Menteng', latitude: -6.1944, longitude: 106.8229, radius: 2000, isActive: true, contactPerson: 'Pak Agus (Ketua RW)' },
  { name: 'RW 002 Kelurahan Kuningan', type: 'RW', email: 'rw002.kuningan@kelurahan.go.id', phone: '0215201234', whatsapp: '6281234567020', address: 'Kantor Kelurahan Kuningan', latitude: -6.2205, longitude: 106.8332, radius: 2000, isActive: true, contactPerson: 'Ibu Dewi (Ketua RW)' },
  
  // Kelurahan Level
  { name: 'Kelurahan Menteng', type: 'KELURAHAN', email: 'menteng@kecamatan.go.id', phone: '0213905678', whatsapp: '6281234567100', address: 'Jl. Menteng Raya No. 1', latitude: -6.1944, longitude: 106.8229, radius: 3000, isActive: true, contactPerson: 'Lurah Bpk. Santoso' },
  { name: 'Kelurahan Kuningan', type: 'KELURAHAN', email: 'kuningan@kecamatan.go.id', phone: '0215205678', whatsapp: '6281234567101', address: 'Jl. HR Rasuna Said Kav. 1', latitude: -6.2205, longitude: 106.8332, radius: 3000, isActive: true, contactPerson: 'Lurah Ibu Ratna' },
  { name: 'Kelurahan Senayan', type: 'KELURAHAN', email: 'senayan@kecamatan.go.id', phone: '0217205678', whatsapp: '6281234567102', address: 'Jl. Tentara Pelajar No. 1', latitude: -6.2258, longitude: 106.8021, radius: 3000, isActive: true, contactPerson: 'Lurah Bpk. Hendra' },
  
  // Kecamatan Level
  { name: 'Kecamatan Menteng', type: 'KECAMATAN', email: 'menteng@jakarta.go.id', phone: '0213101234', whatsapp: '6281234567200', address: 'Jl. Menteng Raya No. 1', latitude: -6.1944, longitude: 106.8229, radius: 5000, isActive: true, contactPerson: 'Camat Bpk. Wijaya' },
  { name: 'Kecamatan Setiabudi', type: 'KECAMATAN', email: 'setiabudi@jakarta.go.id', phone: '0215201234', whatsapp: '6281234567201', address: 'Jl. HR Rasuna Said', latitude: -6.2205, longitude: 106.8332, radius: 5000, isActive: true, contactPerson: 'Camat Ibu Lestari' },
  { name: 'Kecamatan Kebayoran Baru', type: 'KECAMATAN', email: 'kebayoran@jakarta.go.id', phone: '0217201234', whatsapp: '6281234567202', address: 'Jl. Cipete Raya No. 1', latitude: -6.2451, longitude: 106.8078, radius: 5000, isActive: true, contactPerson: 'Camat Bpk. Gunawan' },
  
  // Dinas Level
  { name: 'Dinas Pekerjaan Umum DKI Jakarta', type: 'DINAS_PU', email: 'pu@jakarta.go.id', phone: '0211234567', whatsapp: '6281234567300', address: 'Jl. Medan Merdeka Selatan No. 8-9', latitude: -6.1754, longitude: 106.8272, radius: 50000, isActive: true, contactPerson: 'Kepala Dinas Bpk. Andi' },
  { name: 'Dinas Bina Marga DKI Jakarta', type: 'DINAS_BINA_MARGA', email: 'binamarga@jakarta.go.id', phone: '0211234568', whatsapp: '6281234567301', address: 'Jl. Medan Merdeka Selatan No. 8-9', latitude: -6.1754, longitude: 106.8272, radius: 50000, isActive: true, contactPerson: 'Kepala Dinas Bpk. Budi' },
  { name: 'Dinas Cipta Karya DKI Jakarta', type: 'DINAS_CIPTA_KARYA', email: 'ciptakarya@jakarta.go.id', phone: '0211234569', whatsapp: '6281234567302', address: 'Jl. Medan Merdeka Selatan No. 8-9', latitude: -6.1754, longitude: 106.8272, radius: 50000, isActive: true, contactPerson: 'Kepala Dinas Ibu Maya' },
  { name: 'Dinas Perhubungan DKI Jakarta', type: 'DINAS_PERHUBUNGAN', email: 'perhubungan@jakarta.go.id', phone: '0211234570', whatsapp: '6281234567303', address: 'Jl. Medan Merdeka Selatan No. 8-9', latitude: -6.1754, longitude: 106.8272, radius: 50000, isActive: true, contactPerson: 'Kepala Dinas Bpk. Dodi' },
  
  // Utilities & Emergency
  { name: 'PLN Area Jakarta Pusat', type: 'PLN', email: 'jakartapusat@pln.co.id', phone: '123', whatsapp: '6281234567400', address: 'Jl. Trunojoyo No. 1', latitude: -6.2189, longitude: 106.8192, radius: 20000, isActive: true, contactPerson: 'Manager Area Bpk. Eko' },
  { name: 'PDAM Jaya Jakarta Pusat', type: 'PDAM', email: 'jakartapusat@pdamjaya.co.id', phone: '0211500600', whatsapp: '6281234567401', address: 'Jl. Jenderal Sudirman Kav. 1', latitude: -6.2248, longitude: 106.8123, radius: 20000, isActive: true, contactPerson: 'Manager Area Ibu Fitri' },
  { name: 'Polisi Ditlantas Metro Jaya', type: 'POLISI', email: 'ditlantas@polri.go.id', phone: '0217201234', whatsapp: '6281234567402', address: 'Jl. Jenderal Gatot Subroto', latitude: -6.2248, longitude: 106.8123, radius: 50000, isActive: true, contactPerson: 'Kabid Bpk. Herman' },
  { name: 'BPBD DKI Jakarta', type: 'BPBD', email: 'bpbd@jakarta.go.id', phone: '117', whatsapp: '6281234567403', address: 'Jl. Medan Merdeka Selatan', latitude: -6.1754, longitude: 106.8272, radius: 50000, isActive: true, contactPerson: 'Kepala BPBD Bpk. Imam' }
];

// ─────────────────────────────────────────────
// Initialize Authorities in Database
// ─────────────────────────────────────────────

export async function seedAuthorities() {
  for (const auth of DEFAULT_AUTHORITIES) {
    await prisma.authority.upsert({
      where: { id: `auth-${auth.name.replace(/\s+/g, '-').toLowerCase()}` },
      update: auth,
      create: { 
        id: `auth-${auth.name.replace(/\s+/g, '-').toLowerCase()}`,
        ...auth 
      }
    });
  }
  console.log('[Authority] Default authorities seeded');
}

// ─────────────────────────────────────────────
// Geospatial Functions
// ─────────────────────────────────────────────

/**
 * Find nearest authorities for a location and damage type
 */
export async function findNearestAuthorities(
  latitude: number,
  longitude: number,
  damageType: DamageType,
  limit: number = 5
): Promise<AuthorityMatch[]> {
  // Get active authorities from database
  const authorities = await prisma.authority.findMany({
    where: { isActive: true }
  });

  // Get priority authority types for this damage type
  const priorityTypes = DAMAGE_AUTHORITY_PRIORITY[damageType] || DAMAGE_AUTHORITY_PRIORITY.OTHER;

  // Calculate distance for each authority
  const matches: AuthorityMatch[] = authorities.map((auth: Authority) => {
    const distance = geolib.getDistance(
      { latitude, longitude },
      { latitude: auth.latitude, longitude: auth.longitude }
    );
    
    const isWithinRadius = distance <= auth.radius;
    const priorityScore = priorityTypes.indexOf(auth.type as AuthorityType);
    const typePriority = priorityScore >= 0 ? priorityTypes.length - priorityScore : 0;
    
    return {
      authority: {
        ...auth,
        type: auth.type as AuthorityType
      },
      distance: Math.round(distance),
      isWithinRadius
    };
  });

  // Sort by: within radius first, then by priority type, then by distance
  matches.sort((a: AuthorityMatch, b: AuthorityMatch) => {
    // Within radius first
    if (a.isWithinRadius !== b.isWithinRadius) {
      return a.isWithinRadius ? -1 : 1;
    }
    // Then by type priority
    const aPriority = priorityTypes.indexOf(a.authority.type);
    const bPriority = priorityTypes.indexOf(b.authority.type);
    if (aPriority !== bPriority) {
      return (aPriority >= 0 ? aPriority : 99) - (bPriority >= 0 ? bPriority : 99);
    }
    // Then by distance
    return a.distance - b.distance;
  });

  return matches.slice(0, limit);
}

/**
 * Get best authority match (single)
 */
export async function getBestAuthority(
  latitude: number,
  longitude: number,
  damageType: DamageType
): Promise<AuthorityMatch | null> {
  const matches = await findNearestAuthorities(latitude, longitude, damageType, 1);
  return matches[0] || null;
}

/**
 * Get all authorities within radius
 */
export async function getAuthoritiesInRadius(
  latitude: number,
  longitude: number,
  radiusMeters: number = 10000
): Promise<AuthorityMatch[]> {
  const authorities = await prisma.authority.findMany({
    where: { isActive: true }
  });

  const matches: AuthorityMatch[] = authorities
    .map((auth: Authority) => {
      const distance = geolib.getDistance(
        { latitude, longitude },
        { latitude: auth.latitude, longitude: auth.longitude }
      );
      return {
        authority: { ...auth, type: auth.type as AuthorityType },
        distance: Math.round(distance),
        isWithinRadius: distance <= auth.radius
      };
    })
    .filter((m: AuthorityMatch) => m.distance <= radiusMeters)
    .sort((a: AuthorityMatch, b: AuthorityMatch) => a.distance - b.distance);

  return matches;
}

/**
 * Get authority by ID
 */
export async function getAuthorityById(id: string): Promise<Authority | null> {
  const auth = await prisma.authority.findUnique({ where: { id } });
  return auth ? { ...auth, type: auth.type as AuthorityType } : null;
}

/**
 * Get authorities by type
 */
export async function getAuthoritiesByType(type: AuthorityType): Promise<Authority[]> {
  const auths = await prisma.authority.findMany({
    where: { type, isActive: true }
  });
  return auths.map((a: Authority) => ({ ...a, type: a.type as AuthorityType }));
}

/**
 * Search authorities by name
 */
export async function searchAuthorities(query: string): Promise<Authority[]> {
  const auths = await prisma.authority.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { address: { contains: query, mode: 'insensitive' } },
        { contactPerson: { contains: query, mode: 'insensitive' } }
      ]
    }
  });
  return auths.map((a: Authority) => ({ ...a, type: a.type as AuthorityType }));
}

/**
 * Calculate distance between two points
 */
export function calculateDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  return geolib.getDistance(
    { latitude: lat1, longitude: lng1 },
    { latitude: lat2, longitude: lng2 }
  );
}

/**
 * Check if point is within polygon (for administrative boundaries)
 */
export function isPointInPolygon(
  latitude: number,
  longitude: number,
  polygon: Array<{ latitude: number; longitude: number }>
): boolean {
  return geolib.isPointInPolygon(
    { latitude, longitude },
    polygon
  );
}

/**
 * Get administrative boundary for a location (placeholder - integrate with real GIS)
 */
export async function getAdministrativeBoundary(
  latitude: number,
  longitude: number
): Promise<{ kelurahan?: string; kecamatan?: string; kota?: string; provinsi?: string }> {
  // TODO: Integrate with real GIS service (e.g., Nominatim, Big Data Indonesia, etc.)
  // For now, return mock data based on known coordinates
  
  // This would typically call an external API
  // const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
  // const data = await response.json();
  
  // Mock implementation for Jakarta area
  if (latitude >= -6.3 && latitude <= -6.0 && longitude >= 106.7 && longitude <= 107.0) {
    return {
      provinsi: 'DKI Jakarta',
      kota: 'Jakarta Pusat',
      kecamatan: latitude > -6.2 ? 'Menteng' : 'Setiabudi',
      kelurahan: latitude > -6.21 ? 'Menteng' : 'Kuningan'
    };
  }
  
  return {};
}

// ─────────────────────────────────────────────
// Authority Contact Formatting
// ─────────────────────────────────────────────

/**
 * Format authority contact info for user display
 */
export function formatAuthorityContact(auth: Authority): string {
  const lines = [
    `📍 **${auth.name}** (${auth.type})`,
    `📍 Alamat: ${auth.address}`,
    `📏 Jarak: ${auth.radius >= 1000 ? (auth.radius/1000).toFixed(1) + ' km' : auth.radius + ' m'} radius layanan`
  ];
  
  if (auth.contactPerson) {
    lines.push(`👤 Kontak: ${auth.contactPerson}`);
  }
  if (auth.phone) {
    lines.push(`📞 Telp: ${auth.phone}`);
  }
  if (auth.whatsapp) {
    lines.push(`💬 WhatsApp: ${auth.whatsapp}`);
  }
  if (auth.email) {
    lines.push(`📧 Email: ${auth.email}`);
  }
  
  return lines.join('\n');
}

/**
 * Generate WhatsApp deep link for authority
 */
export function generateWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

/**
 * Generate email mailto link
 */
export function generateEmailLink(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}