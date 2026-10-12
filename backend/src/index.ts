// Main entry point - Fastify server with all routes

import 'dotenv/config';
import Fastify from 'fastify';
import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import csrf from '@fastify/csrf-protection';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { pathToFileURL } from 'url';
import { authenticate } from './middleware/auth.js';
import { prisma } from './lib/db.js';

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.PORT || '3001');
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('FATAL: JWT_SECRET must be set and at least 32 chars');
}
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error('FATAL: SESSION_SECRET must be set and at least 32 chars');
}

// ─────────────────────────────────────────────
// Prisma Plugin
// ─────────────────────────────────────────────

async function prismaPlugin(fastify: any) {
  // Satu PrismaClient bersama (lib/db.ts) — jangan new PrismaClient() per file.
  fastify.decorate('prisma', prisma);

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
}

// ─────────────────────────────────────────────
// JWT Plugin
// ─────────────────────────────────────────────

async function jwtPlugin(fastify: any) {
  await fastify.register(jwt, {
    secret: JWT_SECRET,
    sign: { expiresIn: '7d' },
    verify: { algorithms: ['HS256'] },
    cookie: { cookieName: 'auth_token', signed: false }
  });
}

// ─────────────────────────────────────────────
// Session & CSRF Plugin
// ─────────────────────────────────────────────

async function sessionPlugin(fastify: any) {
  await fastify.register(cookie, {
    secret: SESSION_SECRET,
    hook: 'onRequest',
    parseOptions: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' }
  });
  
  await fastify.register(session, {
    secret: SESSION_SECRET,
    cookie: { 
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 // 24 jam — @fastify/session pakai detik
    },
    saveUninitialized: false,
    rolling: true
  });
  
  await fastify.register(csrf, {
    sessionPlugin: '@fastify/session',
    // Double-submit cookie mode (stateless)
    cookie: { key: 'csrf_token', path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' },
    cookieOpts: { httpOnly: true }
  });
  
  // CSRF protection HANYA untuk request yang memakai cookie auth.
  //
  // Logika (jangan dibalik):
  // - Ada header Bearer  → autentikasi pakai token header, bukan cookie → CSRF tidak berlaku → lewati.
  // - Tidak ada cookie auth_token → login/register/anonymous → lewati (ini yang dulu memblokir login).
  // - Cookie ada & valid → ini jalur yang rentan CSRF (browser otomatis kirim cookie) → wajib token CSRF.
  // - Cookie ada tapi expired/rusak → tidak akan ter-authenticasi juga → lewati.
  fastify.addHook('preHandler', (request: any, reply: any, done: any) => {
    if (request.headers.authorization?.startsWith('Bearer ')) return done();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return done();

    // CSRF tidak berlaku untuk endpoint auth — login/register/logout tidak
    // memerlukan session existing dan aman dari CSRF attack.
    const authPaths = ['/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/auth/logout'];
    if (authPaths.some(p => request.url.startsWith(p))) return done();

    const cookieToken = request.cookies?.auth_token;
    if (!cookieToken) return done();

    try {
      app.jwt.verify(cookieToken); // melempar kalau expired/rusak → lewati, bukan blokir
    } catch {
      return done();
    }

    fastify.csrfProtection(request, reply, done);
  });
}

// ─────────────────────────────────────────────
// Fastify Instance
// ─────────────────────────────────────────────

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV !== 'production' ? {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' }
    } : undefined
  },
  ajv: { customOptions: { coerceTypes: 'array' } }
});

// ─────────────────────────────────────────────
// Register Plugins
// ─────────────────────────────────────────────

await app.register(fp(prismaPlugin));
await app.register(fp(jwtPlugin));
await app.register(fp(sessionPlugin));

await app.register(cors, {
  origin: [FRONTEND_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
});

await app.register(helmet, {
  contentSecurityPolicy: {}, // default CSP (API hanya serve JSON)
  crossOriginEmbedderPolicy: false
});

// API docs di /documentation (README menjanjikan endpoint ini)
await app.register(swagger, {
  openapi: {
    info: { title: 'Lapor Jalan API', version: '1.0.0', description: 'Sistem Pelaporan Kerusakan Infrastruktur Jalan Berbasis AI' }
  }
});
await app.register(swaggerUi, { routePrefix: '/documentation' });

await app.register(rateLimit, {
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  keyGenerator: (req) => req.ip
});
await app.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024, files: 5 } // 10MB, max 5 files
});

await app.register(websocket);

// ─────────────────────────────────────────────
// Decorate authenticate
// ─────────────────────────────────────────────

app.decorate('authenticate', authenticate);

// ─────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────

app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/health/db', async (request, reply) => {
  try {
    await request.server.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', database: 'connected' };
  } catch (err) {
    reply.status(503);
    return { status: 'error', database: 'disconnected', error: String(err) };
  }
});

// ─────────────────────────────────────────────
// Import Routes
// ─────────────────────────────────────────────

import { authRoutes } from './routes/auth.js';
import { reportRoutes } from './routes/reports.js';
import { chatRoutes } from './routes/chat.js';
import { authorityRoutes } from './routes/authorities.js';
import { adminRoutes } from './routes/admin.js';
import { publicRoutes } from './routes/public.js';
import { wsRoutes } from './routes/websocket.js';

// ─────────────────────────────────────────────
// Error Handler & 404 Handler
// ─────────────────────────────────────────────
// PENTING: handler harus di-set SEBELUM route di-register.
// Scope route yang dibuat lewat app.register() MENYIMPAN salinan error handler
// saat dibuat — setErrorHandler setelah register TIDAK menembus ke sana
// (terbukti: semua mapping error {success, error:{code,message}} tidak pernah
// jalan, response jatuh ke handler default Fastify).

app.setErrorHandler(async (error, request, reply) => {
  request.log.error(error);

  // Zod validation errors (bukan shape Fastify AJV — .parse() melempar ZodError)
  if (error.name === 'ZodError') {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        statusCode: 400,
        details: (error as any).issues
      }
    });
  }

  // Validation errors
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        statusCode: 400,
        details: error.validation
      }
    });
  }
  
  // JWT errors
  if (error.code === 'FST_JWT_AUTHORIZATION_FAILED' || error.code === 'FST_JWT_BAD_SIGNATURE') {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token', statusCode: 401 }
    });
  }
  
  // CSRF errors
  // Kode asli @fastify/csrf-protection: FST_CSRF_INVALID_TOKEN / FST_CSRF_MISSING_SECRET
  if (error.code === 'FST_CSRF_INVALID_TOKEN' || error.code === 'FST_CSRF_MISSING_SECRET') {
    return reply.status(403).send({
      success: false,
      error: { code: 'CSRF_INVALID', message: 'Invalid CSRF token', statusCode: 403 }
    });
  }
  
  // Prisma errors
  if (error.name === 'PrismaClientKnownRequestError') {
    if (error.code === 'P2002') {
      return reply.status(409).send({
        success: false,
        error: { code: 'DUPLICATE', message: 'Data already exists', statusCode: 409 }
      });
    }
    if (error.code === 'P2025') {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Record not found', statusCode: 404 }
      });
    }
  }
  
  // Generic error
  const statusCode = error.statusCode || 500;
  return reply.status(statusCode).send({
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
      statusCode
    }
  });
});

// ─────────────────────────────────────────────
// 404 Handler
// ─────────────────────────────────────────────

app.setNotFoundHandler(async (request, reply) => {
  return reply.status(404).send({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Endpoint not found', statusCode: 404 }
  });
});

// ─────────────────────────────────────────────
// Register Routes
// ─────────────────────────────────────────────

await app.register(authRoutes, { prefix: '/api/v1/auth' });
await app.register(reportRoutes, { prefix: '/api/v1/reports' });
await app.register(chatRoutes, { prefix: '/api/v1/chat' });
await app.register(authorityRoutes, { prefix: '/api/v1/authorities' });
await app.register(adminRoutes, { prefix: '/api/v1/admin' });
await app.register(publicRoutes, { prefix: '/api/v1/public' });
await app.register(wsRoutes, { prefix: '/ws' });
// Frontend axios baseURL = '/api/v1' → tanpa mount ini, /api/v1/ws/* (stats,
// broadcast) balik 404. Mount ganda: '/ws' untuk dokumentasi & klien langsung.
await app.register(wsRoutes, { prefix: '/api/v1/ws' });

// ─────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────

async function boot() {
  try {
    await app.ready();
    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 Server running at http://${HOST}:${PORT}`);
    console.log(`📚 API docs: http://${HOST}:${PORT}/documentation`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await app.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...');
  await app.close();
  process.exit(0);
});

// Jangan auto-boot kalau module ini di-import oleh test (app.inject)
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  boot();
}

export { app };