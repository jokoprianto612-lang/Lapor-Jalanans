// Observability Service - AI Tracing & Metrics
// Traces every AI interaction for debugging, evaluation, and monitoring

import type { AITrace, AIMetrics, TraceSpan, GuardrailFlags } from '../types/index';

import { prisma } from '../db';

// ─────────────────────────────────────────────
// In-Memory Trace Store (with cap)
// ─────────────────────────────────────────────
const TRACE_CAP = 500;
const METRICS_WINDOW_MS = 24 * 60 * 60 * 1000;

interface StoredTrace extends AITrace {
  _cachedAt: number;
}

const traceStore: StoredTrace[] = [];
const metricsCache = {
  data: null as AIMetrics | null,
  computedAt: 0
};

// ─────────────────────────────────────────────
// Trace Recording
// ─────────────────────────────────────────────

/**
 * Record a new AI trace
 */
export async function recordTrace(trace: Omit<AITrace, 'id' | 'createdAt'>): Promise<AITrace> {
  const newTrace: AITrace = {
    ...trace,
    id: crypto.randomUUID(),
    createdAt: new Date()
  };

  traceStore.push({
    ...newTrace,
    _cachedAt: Date.now()
  });

  if (traceStore.length > TRACE_CAP) {
    traceStore.shift();
  }

  metricsCache.data = null;

  persistTraceToDb(newTrace).catch(err => {
    console.error('[Observability] Failed to persist trace:', err);
  });

  return newTrace;
}

async function persistTraceToDb(trace: AITrace) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: trace.userId,
        action: 'AI_TRACE',
        entity: 'ai_trace',
        entityId: trace.id,
        newData: {
          sessionId: trace.sessionId,
          model: trace.model,
          duration: trace.duration,
          confidence: trace.confidence,
          guardrailFlags: trace.guardrailFlags,
          spansCount: trace.spans.length,
          inputLength: trace.input.length,
          outputLength: trace.output.length
        },
        createdAt: trace.createdAt
      }
    });
  } catch (err) {
    console.error('[Observability] DB persist error:', err);
  }
}

export function getRecentTraces(limit: number = 50, sessionId?: string): AITrace[] {
  let traces = traceStore;
  
  if (sessionId) {
    traces = traces.filter(t => t.sessionId === sessionId);
  }
  
  return traces
    .slice(-limit)
    .reverse()
    .map(({ _cachedAt, ...trace }) => trace);
}

export function getUserTraces(userId: string, limit: number = 50): AITrace[] {
  return traceStore
    .filter(t => t.userId === userId)
    .slice(-limit)
    .reverse()
    .map(({ _cachedAt, ...trace }) => trace);
}

export function getTraceById(traceId: string): AITrace | null {
  const trace = traceStore.find(t => t.id === traceId);
  if (!trace) return null;
  const { _cachedAt, ...result } = trace;
  return result;
}

// ─────────────────────────────────────────────
// Metrics Computation
// ─────────────────────────────────────────────

export function computeMetrics(windowMs: number = METRICS_WINDOW_MS): AIMetrics {
  const now = Date.now();
  
  if (metricsCache.data && (now - metricsCache.computedAt) < 60000) {
    return metricsCache.data;
  }

  const cutoff = now - windowMs;
  const recentTraces = traceStore.filter(t => t._cachedAt > cutoff);

  if (recentTraces.length === 0) {
    const emptyMetrics: AIMetrics = {
      totalRequests: 0,
      avgDuration: 0,
      avgConfidence: 0,
      errorRate: 0,
      guardrailStats: {
        inputBlocked: 0,
        outputSanitized: 0,
        injectionDetected: 0,
        piiDetected: 0,
        toxicityDetected: 0
      },
      modelUsage: {}
    };
    metricsCache.data = emptyMetrics;
    metricsCache.computedAt = now;
    return emptyMetrics;
  }

  const totalRequests = recentTraces.length;
  const avgDuration = recentTraces.reduce((sum, t) => sum + t.duration, 0) / totalRequests;
  const avgConfidence = recentTraces.reduce((sum, t) => sum + t.confidence, 0) / totalRequests;
  
  const errorTraces = recentTraces.filter(t => 
    t.guardrailFlags.injection || 
    t.confidence < 0.3
  ).length;
  const errorRate = errorTraces / totalRequests;

  const guardrailStats = {
    inputBlocked: recentTraces.filter(t => t.guardrailFlags.injection).length,
    outputSanitized: recentTraces.filter(t => t.guardrailFlags.pii).length,
    injectionDetected: recentTraces.filter(t => t.guardrailFlags.injection).length,
    piiDetected: recentTraces.filter(t => t.guardrailFlags.pii).length,
    toxicityDetected: recentTraces.filter(t => t.guardrailFlags.toxicity).length
  };

  const modelUsage: Record<string, number> = {};
  for (const trace of recentTraces) {
    modelUsage[trace.model] = (modelUsage[trace.model] || 0) + 1;
  }

  const metrics: AIMetrics = {
    totalRequests,
    avgDuration,
    avgConfidence,
    errorRate,
    guardrailStats,
    modelUsage
  };

  metricsCache.data = metrics;
  metricsCache.computedAt = now;

  return metrics;
}

export function getSessionMetrics(sessionId: string): AIMetrics {
  const traces = traceStore.filter(t => t.sessionId === sessionId);
  
  if (traces.length === 0) {
    return {
      totalRequests: 0,
      avgDuration: 0,
      avgConfidence: 0,
      errorRate: 0,
      guardrailStats: {
        inputBlocked: 0,
        outputSanitized: 0,
        injectionDetected: 0,
        piiDetected: 0,
        toxicityDetected: 0
      },
      modelUsage: {}
    };
  }

  const totalRequests = traces.length;
  const avgDuration = traces.reduce((sum, t) => sum + t.duration, 0) / totalRequests;
  const avgConfidence = traces.reduce((sum, t) => sum + t.confidence, 0) / totalRequests;
  const errorTraces = traces.filter(t => t.guardrailFlags.injection || t.confidence < 0.3).length;
  const errorRate = errorTraces / totalRequests;

  const guardrailStats = {
    inputBlocked: traces.filter(t => t.guardrailFlags.injection).length,
    outputSanitized: traces.filter(t => t.guardrailFlags.pii).length,
    injectionDetected: traces.filter(t => t.guardrailFlags.injection).length,
    piiDetected: traces.filter(t => t.guardrailFlags.pii).length,
    toxicityDetected: traces.filter(t => t.guardrailFlags.toxicity).length
  };

  const modelUsage: Record<string, number> = {};
  for (const trace of traces) {
    modelUsage[trace.model] = (modelUsage[trace.model] || 0) + 1;
  }

  return {
    totalRequests,
    avgDuration,
    avgConfidence,
    errorRate,
    guardrailStats,
    modelUsage
  };
}

export function getGuardrailDistribution(): Record<string, number> {
  const distribution: Record<string, number> = {
    injection: 0,
    pii: 0,
    toxicity: 0,
    clean: 0
  };

  for (const trace of traceStore) {
    const flags = trace.guardrailFlags;
    if (flags.injection) distribution.injection++;
    else if (flags.pii) distribution.pii++;
    else if (flags.toxicity) distribution.toxicity++;
    else distribution.clean++;
  }

  return distribution;
}

// ─────────────────────────────────────────────
// Span Helpers
// ─────────────────────────────────────────────

export function createSpan(name: string, input?: unknown): TraceSpan & { end: (output?: unknown, metadata?: Record<string, unknown>) => TraceSpan } {
  const startTime = Date.now();
  
  return {
    name,
    startTime,
    endTime: 0,
    duration: 0,
    input,
    end: (output?: unknown, metadata?: Record<string, unknown>): TraceSpan => {
      const endTime = Date.now();
      return {
        name,
        startTime,
        endTime,
        duration: endTime - startTime,
        input,
        output,
        metadata
      };
    }
  };
}

export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  input?: unknown
): Promise<{ result: T; span: TraceSpan }> {
  const span = createSpan(name, input);
  try {
    const result = await fn();
    return { result, span: span.end(result) };
  } catch (error) {
    return { 
      result: null as any, 
      span: span.end(null, { error: error instanceof Error ? error.message : String(error) }) 
    };
  }
}

// ─────────────────────────────────────────────
// Admin/Management
// ─────────────────────────────────────────────

export function clearTraces() {
  traceStore.length = 0;
  metricsCache.data = null;
}

export function getTraceStoreStats() {
  return {
    storedTraces: traceStore.length,
    cap: TRACE_CAP,
    oldestTrace: traceStore.length > 0 ? traceStore[0].createdAt : null,
    newestTrace: traceStore.length > 0 ? traceStore[traceStore.length - 1].createdAt : null,
    metricsCacheValid: !!metricsCache.data,
    metricsCacheAge: metricsCache.data ? Date.now() - metricsCache.computedAt : null
  };
}

export function exportTraces(sessionId?: string): string {
  const traces = sessionId 
    ? traceStore.filter(t => t.sessionId === sessionId)
    : traceStore;
  
  return JSON.stringify(
    traces.map(({ _cachedAt, ...t }) => t),
    null,
    2
  );
}