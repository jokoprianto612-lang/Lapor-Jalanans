// Auth Routes - Registration, Login, Profile

import { FastifyInstance, FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { hashPassword, verifyPassword } from '../lib/password.js';

// ─────────────────────────────────────────────
// Token & cookie helpers
// ─────────────────────────────────────────────

const AUTH_COOKIE = 'auth_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // detik (bukan ms!)

type TokenUser = { id: string; email: string; role: string; authorityId: string | null; tokenVersion: number };

/** Payload JWT FLAT: { id, email, roles, authorityId, v } — harus cocok dengan middleware/auth.ts */
function signAuthToken(app: FastifyInstance, user: TokenUser): string {
  return app.jwt.sign({
    id: user.id,
    email: user.email,
    roles: [user.role],
    ...(user.authorityId ? { authorityId: user.authorityId } : {}),
    v: user.tokenVersion
  });
}

function setAuthCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE
  });
}

// ─────────────────────────────────────────────
// Login brute-force protection (per akun).
// Rate limit per-IP: config.rateLimit di route login/register.
// ─────────────────────────────────────────────

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; resetAt: number; lockedUntil: number | null }>();

/** @returns sisa lock dalam ms, atau null kalau tidak dikunci */
function loginLockedFor(key: string): number | null {
  const rec = loginAttempts.get(key);
  if (!rec) return null;
  const now = Date.now();
  if (rec.lockedUntil && now < rec.lockedUntil) return rec.lockedUntil - now;
  if (now > rec.resetAt) loginAttempts.delete(key);
  return null;
}

function recordLoginFailure(key: string): void {
  const now = Date.now();
  const rec = loginAttempts.get(key);
  if (!rec || now > rec.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS, lockedUntil: null });
    return;
  }
  rec.count += 1;
  if (rec.count >= LOGIN_MAX_ATTEMPTS) {
    rec.lockedUntil = now + LOGIN_LOCK_MS;
  }
}

function clearLoginFailures(key: string): void {
  loginAttempts.delete(key);
}

setInterval(() => {
  const now = Date.now();
  loginAttempts.forEach((rec, key) => {
    const stale = now > rec.resetAt && (!rec.lockedUntil || now > rec.lockedUntil);
    if (stale) loginAttempts.delete(key);
  });
}, 5 * 60 * 1000).unref?.();

// ─────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email('Email tidak valid'),
  phone: z.string().regex(/^(08|628)\d{8,11}$/, 'Nomor HP tidak valid (format: 08xxxxxxxxxx)').optional(),
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100),
  password: z.string().min(8, 'Password minimal 8 karakter')
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().regex(/^(08|628)\d{8,11}$/).optional(),
  avatar: z.string().url().optional()
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password minimal 8 karakter')
});

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────

export const authRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  
  // Register new user (rate limit per-IP: 10/menit)
  app.post('/register', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const data = registerSchema.parse(request.body);
    
    // Check if email exists
    const existingEmail = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingEmail) {
      return reply.status(409).send({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'Email sudah terdaftar', statusCode: 409 }
      });
    }
    
    // Check phone if provided
    if (data.phone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone: data.phone } });
      if (existingPhone) {
        return reply.status(409).send({
          success: false,
          error: { code: 'PHONE_EXISTS', message: 'Nomor HP sudah terdaftar', statusCode: 409 }
        });
      }
    }
    
    // Hash password (PBKDF2-SHA512, 100k iterasi — lib/password.ts)
    const passwordHash = hashPassword(data.password);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        phone: data.phone,
        name: data.name,
        passwordHash,
        role: 'CITIZEN'
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true, authorityId: true, tokenVersion: true }
    });

    // Generate token + set cookie
    const token = signAuthToken(app, user);
    setAuthCookie(reply, token);
    
    return {
      success: true,
      data: { user, token }
    };
  });
  
  // Login (rate limit per-IP: 10/menit + lockout per-akun 5x gagal / 15 menit)
  app.post('/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const data = loginSchema.parse(request.body);

    const attemptKey = data.email.toLowerCase();
    const lockedFor = loginLockedFor(attemptKey);
    if (lockedFor !== null) {
      return reply.status(429).send({
        success: false,
        error: {
          code: 'LOGIN_LOCKED',
          message: `Terlalu banyak percobaan login. Coba lagi dalam ${Math.ceil(lockedFor / 1000)} detik`,
          statusCode: 429
        }
      });
    }

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      recordLoginFailure(attemptKey);
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Email atau password salah', statusCode: 401 }
      });
    }

    // Verify password (constant-time)
    if (!verifyPassword(data.password, user.passwordHash)) {
      recordLoginFailure(attemptKey);
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Email atau password salah', statusCode: 401 }
      });
    }

    clearLoginFailures(attemptKey);

    // Generate token + set cookie
    const token = signAuthToken(app, user);
    setAuthCookie(reply, token);
    
    return {
      success: true,
      data: { 
        user: { id: user.id, email: user.email, name: user.name, role: user.role, authorityId: user.authorityId, avatar: user.avatar },
        token 
      }
    };
  });
  
  // Logout
  app.post('/logout', async (request, reply) => {
    reply.clearCookie('auth_token', { path: '/' });
    return { success: true, data: { message: 'Logged out successfully' } };
  });
  
  // Get current user
  app.get('/me', { preHandler: [app.authenticate] }, async (request) => {
    const user = (request as any).user;
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { 
        id: true, email: true, name: true, phone: true, avatar: true, 
        role: true, authorityId: true, createdAt: true,
        _count: { select: { reports: true, sessions: true } }
      }
    });
    
    return { success: true, data: { user: fullUser } };
  });
  
  // Update profile
  app.patch('/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const data = updateProfileSchema.parse(request.body);
    
    // Check phone uniqueness if changing
    if (data.phone && data.phone !== user.phone) {
      const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
      if (existing && existing.id !== user.id) {
        return reply.status(409).send({
          success: false,
          error: { code: 'PHONE_EXISTS', message: 'Nomor HP sudah digunakan', statusCode: 409 }
        });
      }
    }
    
    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
      select: { id: true, email: true, name: true, phone: true, avatar: true, role: true, authorityId: true }
    });
    
    return { success: true, data: { user: updated } };
  });
  
  // Change password
  app.post('/change-password', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const data = changePasswordSchema.parse(request.body);
    
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found', statusCode: 404 } });
    }

    // Verify current password (constant-time)
    if (!verifyPassword(data.currentPassword, dbUser.passwordHash)) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_PASSWORD', message: 'Password saat ini salah', statusCode: 401 }
      });
    }

    // Hash new password + naikkan tokenVersion → mencabut SEMUA token lama
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword(data.newPassword),
        tokenVersion: { increment: 1 }
      }
    });

    // Terbitkan token baru supaya sesi berjalan tidak ikut mati
    const token = signAuthToken(app, updated);
    setAuthCookie(reply, token);

    return { success: true, data: { message: 'Password berhasil diubah', token } };
  });
  
  // Get CSRF token
  app.get('/csrf-token', async (request, reply) => {
    const token = await reply.generateCsrf();
    return { success: true, data: { csrf_token: token } };
  });
  
  // Refresh token dari cookie auth_token.
  // ignoreExpiration: JWT mungkin sudah lewat masa berlaku tapi cookie masih hidup
  // (sliding session selama user aktif dalam 7 hari). tokenVersion tetap dicek →
  // token yang sudah dicabut (ganti password) tidak bisa di-refresh.
  app.post('/refresh', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const cookieToken = (request.cookies as Record<string, string | undefined>)?.[AUTH_COOKIE];
    if (!cookieToken) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'No session cookie', statusCode: 401 }
      });
    }

    let payload: { id?: string; v?: number };
    try {
      payload = app.jwt.verify(cookieToken, { ignoreExpiration: true });
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid session cookie', statusCode: 401 }
      });
    }

    if (!payload.id) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid session cookie', statusCode: 401 }
      });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!dbUser || dbUser.tokenVersion !== (payload.v ?? 0)) {
      return reply.status(401).send({
        success: false,
        error: { code: 'TOKEN_REVOKED', message: 'Session revoked, please login again', statusCode: 401 }
      });
    }

    const token = signAuthToken(app, dbUser);
    setAuthCookie(reply, token);

    return { success: true, data: { token } };
  });
};

export default authRoutes;