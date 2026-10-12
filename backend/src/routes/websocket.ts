// WebSocket Routes - Real-time updates for reports and chat
import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { WebSocket } from 'ws';
import type { SocketStream } from '@fastify/websocket';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { authenticate, requireAdmin, requireAuthorityStaff } from '../middleware/auth.js';

import { prisma } from '../lib/db.js';
const JWT_SECRET = process.env.JWT_SECRET || '';

// ─────────────────────────────────────────────
// Connection Management
// ─────────────────────────────────────────────

interface WSClient {
  ws: WebSocket;
  userId: string;
  roles: string[];
  sessionId?: string;
  reportIds: Set<string>;
  subscriptions: Set<string>; // 'reports', 'chat', 'notifications', 'admin'
}

const clients = new Map<string, WSClient>(); // connectionId -> client

function generateConnectionId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

interface WsTokenPayload { id?: string; email?: string; roles?: string[] }

/** Payload JWT FLAT: { id, email, roles, ... } — sama dengan yang dibuat routes/auth.ts */
function parseToken(token: string): WsTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as WsTokenPayload;
  } catch {
    return null;
  }
}

/** Channel yang boleh di-subscribe per role.
 *  'chat' tidak pernah masuk daftar ini — akses chat hanya lewat sessionId + ownership check. */
function allowedChannels(roles: string[]): Set<string> {
  const channels = new Set<string>(['notifications']);
  if (roles.includes('AUTHORITY_STAFF') || roles.includes('ADMIN')) channels.add('reports');
  if (roles.includes('ADMIN')) channels.add('admin');
  return channels;
}

// ─────────────────────────────────────────────
// Message Types
// ─────────────────────────────────────────────

type WSMessageType = 
  | 'AUTH' 
  | 'SUBSCRIBE' 
  | 'UNSUBSCRIBE' 
  | 'REPORT_UPDATE' 
  | 'CHAT_MESSAGE' 
  | 'NOTIFICATION' 
  | 'TYPING' 
  | 'PING' 
  | 'PONG' 
  | 'ERROR'
  | 'ACK';

interface WSMessage {
  type: WSMessageType;
  payload: unknown;
  id?: string;
  timestamp: string;
}

function createMessage(type: WSMessageType, payload: unknown, id?: string): WSMessage {
  return { type, payload, id, timestamp: new Date().toISOString() };
}

function send(ws: WebSocket, message: WSMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcast(message: WSMessage, filter?: (client: WSClient) => boolean) {
  const iter = clients.values();
  let result = iter.next();
  while (!result.done) {
    const client = result.value;
    if (!filter || filter(client)) {
      send(client.ws, message);
    }
    result = iter.next();
  }
}

// ─────────────────────────────────────────────
// Broadcast Helpers
// ─────────────────────────────────────────────

export function broadcastReportUpdate(reportId: string, update: unknown) {
  broadcast(createMessage('REPORT_UPDATE', { reportId, ...(update as Record<string, unknown>) }),
    client => client.reportIds.has(reportId) || client.subscriptions.has('reports'));
}

export function broadcastChatMessage(sessionId: string, message: unknown) {
  broadcast(createMessage('CHAT_MESSAGE', { sessionId, ...(message as Record<string, unknown>) }),
    client => client.sessionId === sessionId || client.subscriptions.has('chat'));
}

export function broadcastNotification(userId: string, notification: unknown) {
  broadcast(createMessage('NOTIFICATION', notification),
    client => client.userId === userId);
}

export function broadcastToAdmins(message: WSMessage) {
  broadcast(message, client => client.subscriptions.has('admin'));
}

// ─────────────────────────────────────────────
// WebSocket Routes
// ─────────────────────────────────────────────

export const wsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  
  app.register(async (fastify) => {
    fastify.get('/realtime', { websocket: true }, (connection: SocketStream, req: FastifyRequest) => {
      const connectionId = generateConnectionId();
      let authenticated = false;
      let client: WSClient | null = null;
      
      const ws = (connection as unknown as { socket: WebSocket }).socket;
      
      console.log(`[WS] New connection: ${connectionId} from ${(req as unknown as { socket?: { remoteAddress?: string } }).socket?.remoteAddress}`);
      
      // Send welcome
      send(ws, createMessage('ACK', { connectionId, message: 'Connected to Lapor Jalan realtime server' }));
      
      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as WSMessage;
          
          switch (message.type) {
            case 'AUTH': {
              const token = (message.payload as { token?: string })?.token;
              if (!token) {
                send(ws, createMessage('ERROR', { code: 'AUTH_REQUIRED', message: 'Token required' }, message.id));
                return;
              }
              
              const decoded = parseToken(token);
              if (!decoded?.id) {
                send(ws, createMessage('ERROR', { code: 'INVALID_TOKEN', message: 'Invalid or expired token' }, message.id));
                return;
              }

              // Role diambil ulang dari DB — sama dengan perilaku HTTP authenticate,
              // supaya role di token yang basi tidak dipakai untuk channel admin/reports.
              const dbUser = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: { id: true, role: true }
              });
              if (!dbUser) {
                send(ws, createMessage('ERROR', { code: 'INVALID_TOKEN', message: 'User no longer exists' }, message.id));
                return;
              }
              const roles = [dbUser.role];

              authenticated = true;
              client = {
                ws,
                userId: dbUser.id,
                roles,
                reportIds: new Set(),
                subscriptions: new Set(['notifications'])
              };
              clients.set(connectionId, client);

              // Auto-subscribe to user's reports
              const userReports = await prisma.report.findMany({
                where: { reporterId: dbUser.id },
                select: { id: true }
              });
              for (const r of userReports) client.reportIds.add(r.id);

              // If authority staff, subscribe to assigned reports
              if (roles.includes('AUTHORITY_STAFF') || roles.includes('ADMIN')) {
                const assignedReports = await prisma.report.findMany({
                  where: { assigneeId: dbUser.id },
                  select: { id: true }
                });
                for (const r of assignedReports) client.reportIds.add(r.id);
                client.subscriptions.add('reports');
              }

              send(ws, createMessage('ACK', { 
                authenticated: true, 
                userId: dbUser.id,
                subscribedReports: client.reportIds.size
              }, message.id));
              break;
            }
            
            case 'SUBSCRIBE': {
              if (!client || !authenticated) {
                send(ws, createMessage('ERROR', { code: 'NOT_AUTHENTICATED', message: 'Authenticate first' }, message.id));
                return;
              }
              
              const payload = message.payload as { channels?: string[]; reportId?: string; sessionId?: string };

              // Whitelist channel per role — tanpa ini, user biasa bisa dengar
              // broadcast 'admin'/'reports' milik semua orang.
              const allowed = allowedChannels(client.roles);
              const channels = payload?.channels || [];
              for (const ch of channels) {
                if (!allowed.has(ch)) {
                  send(ws, createMessage('ERROR', { code: 'CHANNEL_FORBIDDEN', message: `Channel tidak diizinkan: ${ch}` }, message.id));
                  continue;
                }
                client.subscriptions.add(ch);
              }

              // Subscribe laporan spesifik → wajib pemilik / assignee / petugas
              if (payload?.reportId) {
                const report = await prisma.report.findUnique({
                  where: { id: payload.reportId },
                  select: { reporterId: true, assigneeId: true }
                });
                const isStaff = client.roles.includes('AUTHORITY_STAFF') || client.roles.includes('ADMIN');
                const isMember = !!report && (report.reporterId === client.userId || report.assigneeId === client.userId);
                if (!report || (!isMember && !isStaff)) {
                  send(ws, createMessage('ERROR', { code: 'NOT_AUTHORIZED', message: 'Tidak berhak mengakses laporan ini' }, message.id));
                  return;
                }
                client.reportIds.add(payload.reportId);
              }

              // Subscribe chat session → hanya pemilik sesi (IDOR: jangan izinkan sessionId orang lain)
              if (payload?.sessionId) {
                const chatSession = await prisma.session.findUnique({
                  where: { id: payload.sessionId },
                  select: { userId: true }
                });
                if (!chatSession || chatSession.userId !== client.userId) {
                  send(ws, createMessage('ERROR', { code: 'NOT_AUTHORIZED', message: 'Tidak berhak mengakses sesi chat ini' }, message.id));
                  return;
                }
                client.sessionId = payload.sessionId;
                client.subscriptions.add('chat');
              }
              
              send(ws, createMessage('ACK', { 
                subscribed: Array.from(client.subscriptions),
                reportIds: Array.from(client.reportIds)
              }, message.id));
              break;
            }
            
            case 'UNSUBSCRIBE': {
              if (!client) return;
              
              const payload = message.payload as { channels?: string[]; reportId?: string; sessionId?: string };
              const channels = payload?.channels || [];
              for (const ch of channels) {
                client.subscriptions.delete(ch);
              }
              
              if (payload?.reportId) {
                client.reportIds.delete(payload.reportId);
              }
              
              if (payload?.sessionId) {
                client.sessionId = undefined;
                client.subscriptions.delete('chat');
              }
              
              send(ws, createMessage('ACK', { 
                subscribed: Array.from(client.subscriptions)
              }, message.id));
              break;
            }
            
            case 'PING': {
              send(ws, createMessage('PONG', { timestamp: new Date().toISOString() }, message.id));
              break;
            }
            
            case 'TYPING': {
              if (!client || !client.sessionId) return;
              
              const payload = message.payload as { isTyping?: boolean };
              
              // Broadcast typing indicator to others in session
              if (client) {
                const c = client;
                broadcast(createMessage('TYPING', { 
                  sessionId: c.sessionId, 
                  userId: c.userId,
                  isTyping: payload?.isTyping
                }), (other: WSClient) => other.sessionId === c.sessionId && other.userId !== c.userId);
              }
              break;
            }
            
            default:
              send(ws, createMessage('ERROR', { code: 'UNKNOWN_MESSAGE_TYPE', message: `Unknown type: ${message.type}` }, message.id));
          }
        } catch (error) {
          console.error('[WS] Message parse error:', error);
          send(ws, createMessage('ERROR', { code: 'PARSE_ERROR', message: 'Invalid message format' }));
        }
      });
      
      ws.on('close', () => {
        console.log(`[WS] Connection closed: ${connectionId}`);
        clients.delete(connectionId);
      });
      
      ws.on('error', (error: Error) => {
        console.error(`[WS] Connection error: ${connectionId}`, error);
        clients.delete(connectionId);
      });
    });
  });

  // REST endpoint to trigger broadcasts (for webhook callbacks, etc.)
  // Dulu tanpa auth sama sekali → siapa pun bisa push update palsu ke semua user.
  app.post('/broadcast/report', { preHandler: [authenticate, requireAuthorityStaff] }, async (request, reply) => {
    const schema = z.object({
      reportId: z.string().uuid(),
      update: z.object({
        status: z.string(),
        message: z.string(),
        images: z.array(z.string()).optional()
      })
    });
    
    const data = schema.parse(request.body);
    broadcastReportUpdate(data.reportId, data.update);
    
    return { success: true, data: { message: 'Broadcast sent' } };
  });

  app.post('/broadcast/notification', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const schema = z.object({
      userId: z.string().uuid(),
      notification: z.object({
        type: z.string(),
        title: z.string(),
        message: z.string(),
        data: z.record(z.any()).optional()
      })
    });
    
    const data = schema.parse(request.body);
    broadcastNotification(data.userId, data.notification);
    
    return { success: true, data: { message: 'Notification broadcast sent' } };
  });

  // Get connected clients count (admin)
  app.get('/stats', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as unknown as { user: { roles: string[] } }).user;
    if (!user.roles.includes('ADMIN')) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Admin only', statusCode: 403 } });
    }
    
    const allClients = Array.from(clients.values());
    const stats = {
      totalConnections: clients.size,
      authenticatedConnections: allClients.filter(c => c.ws.readyState === WebSocket.OPEN).length,
      subscriptions: {
        reports: allClients.filter(c => c.subscriptions.has('reports')).length,
        chat: allClients.filter(c => c.subscriptions.has('chat')).length,
        notifications: allClients.filter(c => c.subscriptions.has('notifications')).length,
        admin: allClients.filter(c => c.subscriptions.has('admin')).length
      },
      users: new Set(allClients.map(c => c.userId)).size
    };
    
    return { success: true, data: { stats } };
  });
};

export default wsRoutes;