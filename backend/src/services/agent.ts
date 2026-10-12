// Agent Service - Multi-Step Agentic Loop with Tool Calling
// Enables plan → execute → evaluate reasoning with tool registry

import type { Tool, AgentStep, ToolCall, AgentConfig, AgentResult, AIVisionAnalysis, AuthorityMatch, ReportCreateInput, DamageType } from '../types/index.js';
import { recordTrace, createSpan } from './observability.js';
import { guardrails } from './guardrails.js';
import { buildMemoryContext, appendMessage } from './memory.js';
import { ragQuery } from './rag.js';
import { findNearestAuthorities } from './authority.js';
import { analyzeImage } from './vision.js';
import { createReport } from './report.js';
import { sendNotification } from './notification.js';

import { prisma } from '../lib/db.js';

// ─────────────────────────────────────────────
// Tool Registry
// ─────────────────────────────────────────────

/**
 * Tool: RAG Query - Search knowledge base for relevant information
 */
const ragQueryTool: Tool = {
  name: 'rag_query',
  description: 'Cari informasi di basis pengetahuan tentang kerusakan jalan, prosedur pelaporan, dan regulasi terkait',
  execute: async (args: Record<string, unknown>) => {
    const { query, limit = 5 } = args as { query: string; limit?: number };
    return await ragQuery(query, limit);
  }
};

/**
 * Tool: Vision Analysis - Analyze uploaded image for road damage
 */
const visionAnalysisTool: Tool = {
  name: 'vision_analysis',
  description: 'Analisis foto kerusakan jalan untuk mendeteksi jenis kerusakan, tingkat keparahan, dan detail teknis',
  execute: async (args: Record<string, unknown>) => {
    const { imageBase64, location } = args as { imageBase64: string; location?: { lat: number; lng: number } };
    return await analyzeImage(imageBase64, location);
  }
};

/**
 * Tool: Authority Routing - Find appropriate authority for location
 */
const authorityRoutingTool: Tool = {
  name: 'authority_routing',
  description: 'Temukan instansi/otoritas yang bertanggung jawab berdasarkan lokasi dan jenis kerusakan',
  execute: async (args: Record<string, unknown>) => {
    const { latitude, longitude, damageType } = args as { latitude: number; longitude: number; damageType: string };
    return await findNearestAuthorities(latitude, longitude, damageType as DamageType);
  }
};

/**
 * Tool: Create Report - Submit official report to system
 */
const createReportTool: Tool = {
  name: 'create_report',
  description: 'Buat laporan resmi ke sistem dengan data lengkap termasuk analisis AI',
  execute: async (args: Record<string, unknown>) => {
    const reportData = args as unknown as ReportCreateInput & { aiAnalysis: AIVisionAnalysis; trackingCode: string };
    return await createReport({ ...reportData, reporterId: (args as { userId?: string }).userId || '' });
  }
};

/**
 * Tool: Send Notification - Notify user and authorities
 */
const notifyTool: Tool = {
  name: 'send_notification',
  description: 'Kirim notifikasi ke pelapor dan instansi terkait via WhatsApp/Email/SMS',
  execute: async (args: Record<string, unknown>) => {
    const { userId, authorityId, reportId, type, message } = args as { 
      userId: string; 
      authorityId?: string; 
      reportId: string; 
      type: 'WHATSAPP' | 'EMAIL' | 'SMS' | 'PUSH'; 
      message: string;
    };
    return await sendNotification({ userId, authorityId, reportId, type, message, title: 'Notifikasi Lapor Jalan' });
  }
};

/**
 * Tool: List Reports - Get user's report history
 */
const listReportsTool: Tool = {
  name: 'list_reports',
  description: 'Dapatkan daftar laporan sebelumnya milik user',
  execute: async (args: Record<string, unknown>) => {
    const { userId, status, limit = 10 } = args as { userId: string; status?: string; limit?: number };
    const where: any = { reporterId: userId };
    if (status) where.status = status;
    
    const reports = await prisma.report.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      take: limit,
      include: { updates: { orderBy: { createdAt: 'desc' }, take: 1 } }
    });
    
    return reports.map((r: { id: string; trackingCode: string; title: string; status: string; damageType: string; severity: string; address: string; submittedAt: Date; updates: Array<{ id: string; status: string; message: string; images: string[]; createdAt: Date }> }) => ({
      id: r.id,
      trackingCode: r.trackingCode,
      title: r.title,
      status: r.status,
      damageType: r.damageType,
      severity: r.severity,
      address: r.address,
      submittedAt: r.submittedAt,
      latestUpdate: r.updates[0] || null
    }));
  }
};

// ─────────────────────────────────────────────
// Tool Registry
// ─────────────────────────────────────────────

const TOOL_REGISTRY: Record<string, Tool> = {
  rag_query: ragQueryTool,
  vision_analysis: visionAnalysisTool,
  authority_routing: authorityRoutingTool,
  create_report: createReportTool,
  send_notification: notifyTool,
  list_reports: listReportsTool
};

function getAvailableTools(): Tool[] {
  return Object.values(TOOL_REGISTRY);
}

function getToolDescriptions(): string {
  return Object.values(TOOL_REGISTRY)
    .map(t => `- ${t.name}: ${t.description}`)
    .join('\n');
}

// ─────────────────────────────────────────────
// System Prompt
// ─────────────────────────────────────────────

const SYSTEM_PROMPT = `Anda adalah AI Assistant untuk sistem "Lapor Jalan" - platform pelaporan kerusakan infrastruktur jalan otomatis ke pihak berwajib di Indonesia.

TUGAS UTAMA:
1. Bantau warga melaporkan kerusakan jalan (lubang, retak, longsor, drainase, dll) melalui chat
2. Analisis foto yang diupload untuk identifikasi kerusakan otomatis
3. Tentukan instansi yang bertanggung jawab (RT, RW, Kelurahan, Kecamatan, Dinas PU, Dinas Bina Marga, PLN, PDAM, dll)
4. Buat laporan resmi dengan tracking code
5. Kirim notifikasi ke pelapor dan instansi terkait

ALAT YANG TERSEDIA:
${getToolDescriptions()}

FORMAT TOOL CALLING:
Untuk menggunakan tool, gunakan format EXAKT berikut di respons Anda:

TOOL: <nama_tool>
ARGS: <json_args>

CONTOH:
TOOL: rag_query
ARGS: {"query": "prosedur lapor lubang jalan ke RT", "limit": 3}

TOOL: vision_analysis
ARGS: {"imageBase64": "base64_string_here", "location": {"lat": -6.2, "lng": 106.8}}

TOOL: authority_routing
ARGS: {"latitude": -6.2, "longitude": 106.8, "damageType": "POTHOLE"}

TOOL: create_report
ARGS: {"title": "Lubang di Jalan Raya", "description": "Lubang berukuran 30x40cm", "damageType": "POTHOLE", "severity": "HIGH", "latitude": -6.2, "longitude": 106.8, "address": "Jl. Sudirman No. 1", "images": ["base64_1", "base64_2"], "aiAnalysis": {...}, "trackingCode": "abc-123"}

TOOL: send_notification
ARGS: {"userId": "user-123", "reportId": "report-456", "type": "WHATSAPP", "message": "Laporan Anda telah diterima dengan kode tracking ABC123"}

TOOL: list_reports
ARGS: {"userId": "user-123", "limit": 5}

ATURAN:
1. Hanya panggil SATU tool per langkah
2. Tunggu hasil tool sebelum melanjutkan
3. Gunakan bahasa Indonesia yang natural dan ramah
4. Selalu konfirmasi detail penting dengan user sebelum submit laporan
5. Jika user upload foto, WAJIB gunakan vision_analysis
6. Jika lokasi diberikan, WAJIB gunakan authority_routing
7. Maksimal 4 langkah (max steps) per percakapan
8. Jika tidak yakin, tanyakan ke user - jangan asumsi

MULAI PERCAKAPAN DENGAN MENYAPA DAN MENANYA KELUHAN USER.`;

// ─────────────────────────────────────────────
// Agent Loop
// ─────────────────────────────────────────────

/**
 * Run the agentic loop
 */
export async function runAgent(
  userId: string,
  sessionId: string,
  userMessage: string,
  config: Partial<AgentConfig> = {}
): Promise<AgentResult> {
  const startTime = Date.now();
  const maxSteps = config.maxSteps || 4;
  const tools = config.tools || getAvailableTools();
  
  // Build conversation history
  const recentMessages = await getRecentMessages(sessionId, 10);
  const memoryContext = buildMemoryContext(userId, sessionId);
  
  // Build initial prompt
  let prompt = `${SYSTEM_PROMPT}\n\n${memoryContext}\n\n`;
  
  // Add recent conversation
  if (recentMessages.length > 0) {
    prompt += 'RIWAYAT PERCAKAPAN:\n';
    for (const msg of recentMessages) {
      prompt += `${msg.role}: ${msg.content}\n`;
    }
    prompt += '\n';
  }
  
  prompt += `USER: ${userMessage}\n\nASSISTANT:`;
  
  const steps: AgentStep[] = [];
  const allToolCalls: ToolCall[] = [];
  let finalAnswer = '';
  let stepCount = 0;
  
  // Agent loop
  while (stepCount < maxSteps) {
    stepCount++;
    
    // Call LLM (simulated - replace with actual LLM call)
    const llmResponse = await callLLM(prompt, tools);
    
    // Parse tool calls from response
    const toolCalls = parseToolCalls(llmResponse);
    
    if (toolCalls.length === 0) {
      // No tool calls - this is the final answer
      finalAnswer = llmResponse.trim();
      break;
    }
    
    // Execute tool calls (only first one per step)
    const toolCall = toolCalls[0];
    const tool = TOOL_REGISTRY[toolCall.name];
    
    let observation = '';
    let toolError: string | undefined;
    
    if (tool) {
      try {
        const result = await tool.execute(toolCall.args);
        observation = JSON.stringify(result, null, 2);
        toolCall.result = result;
      } catch (error) {
        toolError = error instanceof Error ? error.message : String(error);
        observation = `ERROR: ${toolError}`;
        toolCall.error = toolError;
      }
    } else {
      toolError = `Tool tidak ditemukan: ${toolCall.name}`;
      observation = `ERROR: ${toolError}`;
      toolCall.error = toolError;
    }
    
    allToolCalls.push(toolCall);
    
    // Record step
    steps.push({
      thought: extractThought(llmResponse),
      toolCalls: [toolCall],
      observation
    });
    
    // Add to prompt for next iteration
    prompt += `\n${llmResponse}\n\nOBSERVATION: ${observation}\n\nASSISTANT:`;
    
    // Save tool call to session
    await appendMessage(sessionId, userId, 'TOOL', 
      `Tool: ${toolCall.name}`, 
      { toolCall, result: toolCall.result, error: toolCall.error }
    );
  }
  
  // Save final answer
  await appendMessage(sessionId, userId, 'ASSISTANT', finalAnswer, { steps, toolCalls: allToolCalls });
  
  const duration = Date.now() - startTime;
  
  // Record trace
  await recordTrace({
    sessionId,
    userId,
    input: userMessage,
    output: finalAnswer,
    model: 'nemotron-3-ultra',
    duration,
    confidence: calculateConfidence(steps, allToolCalls),
    guardrailFlags: guardrails.getFlags(userMessage, finalAnswer),
    spans: steps.flatMap(s => s.toolCalls.map(tc => ({
      name: tc.name,
      startTime: Date.now(),
      endTime: Date.now(),
      duration: 0,
      input: tc.args,
      output: tc.result,
      metadata: { error: tc.error }
    })))
  });
  
  return {
    answer: finalAnswer,
    steps,
    toolCalls: allToolCalls,
    duration
  };
}

/**
 * Fallback: Single RAG query when LLM unavailable
 */
export async function fallbackRAGQuery(
  userId: string,
  sessionId: string,
  query: string
): Promise<AgentResult> {
  const startTime = Date.now();
  const results = await ragQuery(query, 5);
  
  let answer = `Berikut informasi yang relevan untuk "${query}":\n\n`;
  
  if (results.length === 0) {
    answer += 'Maaf, tidak ditemukan informasi yang relevan. Silakan coba kata kunci lain atau hubungi admin.';
  } else {
    for (const [i, result] of results.entries()) {
      answer += `${i + 1}. **${result.title}**\n${result.content.substring(0, 300)}...\n\n`;
    }
    answer += 'Apakah ada yang bisa saya bantu lebih lanjut?';
  }
  
  await appendMessage(sessionId, userId, 'ASSISTANT', answer);
  
  await recordTrace({
    sessionId,
    userId,
    input: query,
    output: answer,
    model: 'rag-fallback',
    duration: Date.now() - startTime,
    confidence: 0.7,
    guardrailFlags: guardrails.getFlags(query, answer),
    spans: []
  });
  
  return {
    answer,
    steps: [],
    toolCalls: [],
    duration: Date.now() - startTime
  };
}

// ─────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────

/**
 * Call LLM via OpenAI-compatible API (OpenAI, NVIDIA NIM, OpenRouter, Ollama, etc.)
 * Requires: LLM_API_ENDPOINT, LLM_API_KEY, LLM_MODEL env vars
 */
async function callLLM(prompt: string, tools: Tool[]): Promise<string> {
  const endpoint = (process.env.LLM_API_ENDPOINT || '').trim();
  const apiKey = (process.env.LLM_API_KEY || '').trim();
  const model = (process.env.LLM_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b').trim();

  if (!endpoint || !apiKey) {
    throw new Error('LLM provider not configured: set LLM_API_ENDPOINT and LLM_API_KEY');
  }

  const url = endpoint.endsWith('/') ? endpoint + 'chat/completions' : endpoint + '/chat/completions';

  const controller = new AbortController();
  const llmTimeout = parseInt(process.env.LLM_TIMEOUT_MS || '60000', 10);
  const timeout = setTimeout(() => controller.abort(), llmTimeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error ${response.status}: ${errorText}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('LLM API returned empty response');
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parse tool calls from LLM response
 */
function parseToolCalls(response: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  
  // Regex to match TOOL: ... ARGS: ... format
  const regex = /TOOL:\s*(\w+)\s*\nARGS:\s*(\{[\s\S]*?})(?=\n+(?:TOOL:|ASSISTANT:)|$)/g;
  let match;
  
  while ((match = regex.exec(response)) !== null) {
    try {
      const name = match[1].trim();
      const args = JSON.parse(match[2].trim());
      toolCalls.push({ name, args });
    } catch (e) {
      console.error('[Agent] Failed to parse tool call:', e);
    }
  }
  
  return toolCalls;
}

/**
 * Extract thought/reasoning from LLM response (text before tool call)
 */
function extractThought(response: string): string {
  const toolIndex = response.indexOf('TOOL:');
  if (toolIndex === 0) {
    return '';
  }
  if (toolIndex > 0) {
    return response.substring(0, toolIndex).trim();
  }
  return response.trim();
}

/**
 * Calculate confidence based on steps and tool results
 */
function calculateConfidence(steps: AgentStep[], toolCalls: ToolCall[]): number {
  if (toolCalls.length === 0) return 0.5;
  
  const errorCount = toolCalls.filter(tc => tc.error).length;
  const successRate = (toolCalls.length - errorCount) / toolCalls.length;
  
  // Base confidence on success rate and number of steps
  return Math.min(0.5 + (successRate * 0.4) + (Math.min(steps.length, 4) * 0.025), 0.95);
}

/**
 * Get recent messages for context
 */
async function getRecentMessages(sessionId: string, limit: number) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { messages: { orderBy: { createdAt: 'desc' }, take: limit } }
  });
  
  return session?.messages
    .reverse()
    .map((m) => ({ role: m.role, content: m.content, metadata: m.metadata })) || [];
}

/**
 * Get agent configuration
 */
export function getAgentConfig(): AgentConfig {
  return {
    maxSteps: 4,
    tools: getAvailableTools(),
    systemPrompt: SYSTEM_PROMPT
  };
}