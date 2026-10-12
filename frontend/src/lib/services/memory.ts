// Memory Service - Persistent Conversation Store
// Session messages + Cross-session user memory + Context builder

import type { UserMemoryEntry, MemoryContext } from '../types/index';
import type { Prisma } from '@prisma/client';

import { prisma } from '../db';

// ─────────────────────────────────────────────
// In-Memory Cache (with caps to prevent leaks)
// ─────────────────────────────────────────────
const SESSION_MESSAGE_CAP = 100;
const USER_MEMORY_CAP = 50;
const TRACE_CAP = 500;

interface CachedSession {
  messages: Array<{
    id: string;
    role: string;
    content: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
  }>;
  updatedAt: Date;
}

interface CachedUserMemory {
  preferences: Record<string, string>;
  topics: Map<string, number>;
  patterns: Map<string, number>;
  commonAuthorities: Map<string, number>;
  updatedAt: Date;
}

const sessionCache = new Map<string, CachedSession>();
const userMemoryCache = new Map<string, CachedUserMemory>();

// ─────────────────────────────────────────────
// Session Management
// ─────────────────────────────────────────────

/**
 * Get or create a session
 */
export async function getOrCreateSession(sessionId: string, userId: string, title?: string) {
  // Check cache first
  const cached = sessionCache.get(sessionId);
  if (cached) {
    return cached.messages;
  }

  // Load from database
  let session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { messages: { orderBy: { createdAt: 'asc' } } }
  });

  if (!session) {
    session = await prisma.session.create({
      data: { id: sessionId, userId, title },
      include: { messages: true }
    });
  }

  // Cache it
  const messages = session.messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    metadata: m.metadata as Record<string, unknown> | undefined,
    createdAt: m.createdAt
  }));

  sessionCache.set(sessionId, {
    messages,
    updatedAt: new Date()
  });

  // Enforce cache cap
  enforceSessionCacheCap();

  return messages;
}

/**
 * Sanitize content for database storage
 * Removes emoji and other non-WIN1252 compatible characters
 */
function sanitizeForDb(content: string): string {
  // Remove emoji and other non-BMP characters (without u flag for compatibility)
  return content
    .replace(/[\uD800-\uDFFF]/g, '') // Surrogate pairs (emoji)
    .replace(/[\u2600-\u27FF]/g, '') // Misc symbols
    .replace(/[\uFE00-\uFE0F]/g, '') // Variation selectors
    .replace(/[\u2000-\u206F]/g, ' ') // General punctuation → space
    .replace(/[\u2190-\u21FF]/g, ' ') // Arrows → space
    .replace(/[\u2B00-\u2BFF]/g, '') // Misc symbols and arrows
    .trim();
}

/**
 * Append a message to a session
 */
export async function appendMessage(
  sessionId: string,
  userId: string,
  role: string,
  content: string,
  metadata?: Record<string, unknown>
) {
  // Ensure session exists
  await getOrCreateSession(sessionId, userId);

  // Sanitize content for database (remove emoji that break WIN1252 encoding)
  const sanitizedContent = sanitizeForDb(content);

  // Save to database
  const message = await prisma.message.create({
    data: {
      sessionId,
      role,
      content: sanitizedContent,
      // Record<string, unknown> tidak structurally assignable ke Prisma.InputJsonValue;
      // caller selalu kirim objek JSON-safe (lihat pemanggil di chat.ts / agent.ts).
      metadata: (metadata ?? {}) as Prisma.InputJsonValue
    }
  });

  // Update cache
  const cached = sessionCache.get(sessionId);
  if (cached) {
    cached.messages.push({
      id: message.id,
      role: message.role,
      content: message.content,
      metadata: message.metadata as Record<string, unknown> | undefined,
      createdAt: message.createdAt
    });
    
    // Enforce message cap per session
    if (cached.messages.length > SESSION_MESSAGE_CAP) {
      cached.messages = cached.messages.slice(-SESSION_MESSAGE_CAP);
    }
    
    cached.updatedAt = new Date();
  }

  // Update user memory based on interaction
  await trackUserInteraction(userId, role, content, metadata);

  return message;
}

/**
 * Get recent messages for context building
 */
export function getRecentMessages(sessionId: string, limit: number = 20): Array<{
  role: string;
  content: string;
  metadata?: Record<string, unknown>;
}> {
  const cached = sessionCache.get(sessionId);
  if (!cached) return [];

  return cached.messages
    .slice(-limit)
    .map(m => ({ role: m.role, content: m.content, metadata: m.metadata }));
}

// ─────────────────────────────────────────────
// User Memory (Cross-Session)
// ─────────────────────────────────────────────

/**
 * Track user interaction to build memory profile
 */
export async function trackUserInteraction(
  userId: string,
  role: string,
  content: string,
  metadata?: Record<string, unknown>
) {
  if (role !== 'USER') return; // Only track user messages

  // Load or create user memory cache
  let cached = userMemoryCache.get(userId);
  if (!cached) {
    cached = await loadUserMemoryCache(userId);
  }

  // Extract topics from content (simple keyword extraction)
  const topics = extractTopics(content);
  for (const topic of topics) {
    const count = (cached.topics.get(topic) || 0) + 1;
    cached.topics.set(topic, count);
  }

  // Track authority mentions
  const authorities = extractAuthorities(content);
  for (const auth of authorities) {
    const count = (cached.commonAuthorities.get(auth) || 0) + 1;
    cached.commonAuthorities.set(auth, count);
  }

  // Track patterns (common phrases, complaint types)
  const patterns = extractPatterns(content);
  for (const pattern of patterns) {
    const count = (cached.patterns.get(pattern) || 0) + 1;
    cached.patterns.set(pattern, count);
  }

  // Save to database periodically (every 5 interactions)
  const interactionCount = Array.from(cached.topics.values()).reduce((a, b) => a + b, 0);
  if (interactionCount % 5 === 0) {
    await persistUserMemory(userId, cached);
  }

  cached.updatedAt = new Date();
  userMemoryCache.set(userId, cached);
  
  // Enforce cache cap
  enforceUserMemoryCacheCap();
}

/**
 * Load user memory from database into cache
 */
async function loadUserMemoryCache(userId: string): Promise<CachedUserMemory> {
  const memories = await prisma.userMemory.findMany({
    where: { userId }
  });

  const preferences: Record<string, string> = {};
  const topics = new Map<string, number>();
  const patterns = new Map<string, number>();
  const commonAuthorities = new Map<string, number>();

  for (const mem of memories) {
    if (mem.category === 'PREFERENCE') {
      preferences[mem.key] = mem.value;
    } else if (mem.category === 'TOPIC') {
      topics.set(mem.key, parseInt(mem.value) || 1);
    } else if (mem.category === 'PATTERN') {
      patterns.set(mem.key, parseInt(mem.value) || 1);
    }
  }

  return {
    preferences,
    topics,
    patterns,
    commonAuthorities,
    updatedAt: new Date()
  };
}

/**
 * Persist user memory cache to database
 */
async function persistUserMemory(userId: string, cached: CachedUserMemory) {
  // Upsert preferences
  for (const [key, value] of Object.entries(cached.preferences)) {
    await prisma.userMemory.upsert({
      where: { userId_key: { userId, key } },
      update: { value, updatedAt: new Date() },
      create: { userId, key, value, category: 'PREFERENCE' }
    });
  }

  // Upsert topics
  for (const [key, count] of Array.from(cached.topics.entries())) {
    await prisma.userMemory.upsert({
      where: { userId_key: { userId, key } },
      update: { value: count.toString(), updatedAt: new Date() },
      create: { userId, key, value: count.toString(), category: 'TOPIC' }
    });
  }

  // Upsert patterns
  for (const [key, count] of Array.from(cached.patterns.entries())) {
    await prisma.userMemory.upsert({
      where: { userId_key: { userId, key } },
      update: { value: count.toString(), updatedAt: new Date() },
      create: { userId, key, value: count.toString(), category: 'PATTERN' }
    });
  }

  // Upsert common authorities
  for (const [key, count] of Array.from(cached.commonAuthorities.entries())) {
    await prisma.userMemory.upsert({
      where: { userId_key: { userId, key } },
      update: { value: count.toString(), updatedAt: new Date() },
      create: { userId, key, value: count.toString(), category: 'PATTERN' }
    });
  }
}

/**
 * Set a user preference explicitly
 */
export async function setUserPreference(userId: string, key: string, value: string) {
  let cached = userMemoryCache.get(userId);
  if (!cached) {
    cached = await loadUserMemoryCache(userId);
  }

  cached.preferences[key] = value;
  await prisma.userMemory.upsert({
    where: { userId_key: { userId, key } },
    update: { value, updatedAt: new Date() },
    create: { userId, key, value, category: 'PREFERENCE' }
  });
}

/**
 * Get a user preference
 */
export async function getUserPreference(userId: string, key: string): Promise<string | null> {
  let cached = userMemoryCache.get(userId);
  if (!cached) {
    cached = await loadUserMemoryCache(userId);
  }
  return cached.preferences[key] || null;
}

// ─────────────────────────────────────────────
// Context Building
// ─────────────────────────────────────────────

/**
 * Build memory context string for LLM prompt injection
 */
export function buildMemoryContext(userId: string, sessionId: string): string {
  const cached = userMemoryCache.get(userId);
  const sessionMessages = getRecentMessages(sessionId, 10);

  const parts: string[] = [];

  // User preferences
  if (cached && Object.keys(cached.preferences).length > 0) {
    const prefs = Object.entries(cached.preferences)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    parts.push(`[Preferensi User] ${prefs}`);
  }

  // Frequent topics
  if (cached && cached.topics.size > 0) {
    const topTopics = Array.from(cached.topics.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic)
      .join(', ');
    parts.push(`[Topik Sering Dibahas] ${topTopics}`);
  }

  // Common authorities contacted
  if (cached && cached.commonAuthorities.size > 0) {
    const topAuths = Array.from(cached.commonAuthorities.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([auth]) => auth)
      .join(', ');
    parts.push(`[Instansi Sering Dihubungi] ${topAuths}`);
  }

  // Recent conversation
  if (sessionMessages.length > 0) {
    const recent = sessionMessages
      .slice(-5)
      .map(m => `${m.role}: ${m.content.substring(0, 100)}`)
      .join('\n');
    parts.push(`[Percakapan Terbaru]\n${recent}`);
  }

  return parts.length > 0 ? parts.join('\n\n') : '[Belum ada konteks memori]';
}

/**
 * Get memory statistics for admin/observability
 */
export async function getMemoryStats(userId?: string) {
  if (userId) {
    const cached = userMemoryCache.get(userId) || await loadUserMemoryCache(userId);
    const sessionCount = await prisma.session.count({ where: { userId } });
    const messageCount = await prisma.message.count({ where: { session: { userId } } });

    return {
      userId,
      sessions: sessionCount,
      messages: messageCount,
      preferences: Object.keys(cached.preferences).length,
      topics: cached.topics.size,
      patterns: cached.patterns.size,
      commonAuthorities: cached.commonAuthorities.size
    };
  }

  // Global stats
  const totalUsers = await prisma.user.count();
  const totalSessions = await prisma.session.count();
  const totalMessages = await prisma.message.count();
  const totalMemories = await prisma.userMemory.count();

  return {
    totalUsers,
    totalSessions,
    totalMessages,
    totalMemories,
    cachedSessions: sessionCache.size,
    cachedUsers: userMemoryCache.size
  };
}

// ─────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────

function extractTopics(content: string): string[] {
  const topicKeywords = [
    'jalan', 'lubang', 'retak', 'longsor', 'drainase', 'banjir',
    'lampu', 'rambu', 'trotoar', 'jembatan', 'aspal', 'beton',
    'rt', 'rw', 'kelurahan', 'kecamatan', 'dinas', 'pemerintah',
    'lapor', 'aduan', 'keluhan', 'perbaikan', 'rusak', 'bahaya'
  ];

  const lower = content.toLowerCase();
  return topicKeywords.filter(kw => lower.includes(kw));
}

function extractAuthorities(content: string): string[] {
  const authKeywords = [
    'rt', 'rw', 'kelurahan', 'kecamatan', 'dinas pu', 'dinas bina marga',
    'polisi', 'pln', 'pdam', 'telkom', 'bpbd', 'satpol pp'
  ];

  const lower = content.toLowerCase();
  return authKeywords.filter(kw => lower.includes(kw));
}

function extractPatterns(content: string): string[] {
  // Simple pattern extraction - could be enhanced with NLP
  const patterns: string[] = [];
  
  // Complaint patterns
  if (/(tolong|bantu|minta|perbaiki|segera)/i.test(content)) {
    patterns.push('request_action');
  }
  if (/(bahaya|parah|darurat|mendesak)/i.test(content)) {
    patterns.push('urgent');
  }
  if (/(foto|gambar|bukti|dokumentasi)/i.test(content)) {
    patterns.push('with_evidence');
  }
  
  return patterns;
}

function enforceSessionCacheCap() {
  if (sessionCache.size > 1000) {
    // Remove oldest 100 sessions
    const entries = Array.from(sessionCache.entries())
      .sort((a, b) => a[1].updatedAt.getTime() - b[1].updatedAt.getTime());
    
    for (let i = 0; i < 100; i++) {
      sessionCache.delete(entries[i][0]);
    }
  }
}

function enforceUserMemoryCacheCap() {
  if (userMemoryCache.size > 5000) {
    const entries = Array.from(userMemoryCache.entries())
      .sort((a, b) => a[1].updatedAt.getTime() - b[1].updatedAt.getTime());
    
    for (let i = 0; i < 500; i++) {
      userMemoryCache.delete(entries[i][0]);
    }
  }
}

// ─────────────────────────────────────────────
// Cleanup
// ─────────────────────────────────────────────

/**
 * Clear a specific session from cache
 */
export function clearSessionCache(sessionId: string) {
  sessionCache.delete(sessionId);
}

/**
 * Clear a specific user's memory cache
 */
export function clearUserMemoryCache(userId: string) {
  userMemoryCache.delete(userId);
}

/**
 * Clear all caches (for testing/admin)
 */
export function clearAllCaches() {
  sessionCache.clear();
  userMemoryCache.clear();
}