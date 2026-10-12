// Auth Middleware - JWT Authentication & Authorization

import { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthUser } from '../types/index.js';

import { prisma } from '../lib/db.js';

// ─────────────────────────────────────────────
// JWT Verification
// ─────────────────────────────────────────────

/**
 * Authenticate request - verify JWT token
 *
 * Sumber token (sesuai konfigurasi @fastify/jwt di index.ts):
 *   1. Header `Authorization: Bearer <jwt>`  (dipakai frontend)
 *   2. Cookie `auth_token`                   (fallback, dipakai endpoint /auth/refresh)
 *
 * Payload JWT dibuat FLAT: { id, email, roles, authorityId, v }.
 * Setelah verifikasi, data user diambil ulang dari DB supaya role & tokenVersion
 * selalu segar (token lama otomatis mati setelah ganti password → tokenVersion naik).
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Verify JWT token
    await request.jwtVerify();

    const payload = request.user as (AuthUser & { v?: number }) | undefined;

    if (!payload?.id) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid token', statusCode: 401 }
      });
    }

    // Verify user still exists and is active
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, name: true, phone: true, avatar: true, role: true, authorityId: true, tokenVersion: true }
    });

    if (!dbUser) {
      return reply.status(401).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User no longer exists', statusCode: 401 }
      });
    }

    // Token dicabut? (mis. ganti password menaikkan tokenVersion)
    if (dbUser.tokenVersion !== (payload.v ?? 0)) {
      return reply.status(401).send({
        success: false,
        error: { code: 'TOKEN_REVOKED', message: 'Session revoked, please login again', statusCode: 401 }
      });
    }

    // Attach fresh user data (roles = array, konsisten dengan format JWT)
    (request as any).user = { ...dbUser, roles: [dbUser.role] };

  } catch (err) {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 }
    });
  }
}

/**
 * Optional authentication - doesn't fail if no token
 */
export async function optionalAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const payload = request.user as (AuthUser & { v?: number }) | undefined;
    if (payload?.id) {
      const dbUser = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { id: true, email: true, name: true, phone: true, avatar: true, role: true, authorityId: true, tokenVersion: true }
      });
      if (dbUser && dbUser.tokenVersion === (payload.v ?? 0)) {
        (request as any).user = { ...dbUser, roles: [dbUser.role] };
      }
    }
  } catch {
    // Ignore - optional auth
  }
}

/**
 * Require specific role(s)
 */
export function requireRole(...roles: string[]) {
  return async function(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user as AuthUser;
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 }
      });
    }
    
    const hasRole = user.roles.some(r => roles.includes(r));
    if (!hasRole) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: `Requires role: ${roles.join(' or ')}`, statusCode: 403 }
      });
    }
  };
}

/**
 * Require admin role
 */
export const requireAdmin = requireRole('ADMIN');

/**
 * Require authority staff role
 */
export const requireAuthorityStaff = requireRole('AUTHORITY_STAFF', 'ADMIN');

/**
 * Require citizen role (default)
 */
export const requireCitizen = requireRole('CITIZEN', 'AUTHORITY_STAFF', 'ADMIN');

// ─────────────────────────────────────────────
// Resource Ownership Checks
// ─────────────────────────────────────────────

/**
 * Check if user owns resource or is admin/staff
 */
export async function checkOwnershipOrStaff(
  request: FastifyRequest,
  reply: FastifyReply,
  resourceUserId: string
) {
  const user = (request as any).user as AuthUser;
  if (!user) {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 }
    });
  }
  
  const isOwner = user.id === resourceUserId;
  const isStaff = user.roles.includes('ADMIN') || user.roles.includes('AUTHORITY_STAFF');
  
  if (!isOwner && !isStaff) {
    return reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access denied', statusCode: 403 }
    });
  }
  
  return true;
}

/**
 * Check if user is assigned to report or is admin
 */
export async function checkReportAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  reportId: string
) {
  const user = (request as any).user as AuthUser;
  if (!user) {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 }
    });
  }
  
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { reporterId: true, assigneeId: true }
  });
  
  if (!report) {
    return reply.status(404).send({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Report not found', statusCode: 404 }
    });
  }
  
  const isReporter = report.reporterId === user.id;
  const isAssignee = report.assigneeId === user.id;
  const isAdmin = user.roles.includes('ADMIN');
  const isStaff = user.roles.includes('AUTHORITY_STAFF');
  
  if (!isReporter && !isAssignee && !isAdmin && !isStaff) {
    return reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access denied to this report', statusCode: 403 }
    });
  }
  
  return true;
}

// ─────────────────────────────────────────────
// Rate Limiting by User
// ─────────────────────────────────────────────

const userRateLimits = new Map<string, { count: number; resetAt: number }>();

/**
 * Rate limiter per user (for report submission, etc.)
 */
export function userRateLimit(maxRequests: number, windowMs: number) {
  return async function(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user as AuthUser;
    if (!user) return; // Let auth handle it
    
    const key = `ratelimit:${user.id}`;
    const now = Date.now();
    const record = userRateLimits.get(key);
    
    if (!record || now > record.resetAt) {
      userRateLimits.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }
    
    if (record.count >= maxRequests) {
      return reply.status(429).send({
        success: false,
        error: { 
          code: 'RATE_LIMITED', 
          message: `Terlalu banyak permintaan. Coba lagi dalam ${Math.ceil((record.resetAt - now) / 1000)} detik`,
          statusCode: 429 
        }
      });
    }
    
    record.count++;
  };
}

// Cleanup old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  userRateLimits.forEach((record, key) => {
    if (now > record.resetAt) {
      userRateLimits.delete(key);
    }
  });
}, 5 * 60 * 1000).unref?.(); // tiap 5 menit — unref supaya interval tidak menahan proses (test / tsx watch)