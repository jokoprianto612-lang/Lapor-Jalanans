// Type definitions for Lapor Jalan

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  authorityId?: string;
}

export interface JWTPayload {
  user: AuthUser;
  iat: number;
  exp: number;
}

export type DamageType = 
  | 'POTHOLE' 
  | 'CRACK' 
  | 'SUBSIDENCE' 
  | 'DRAINAGE' 
  | 'SIGN_DAMAGE' 
  | 'LIGHTING' 
  | 'OTHER';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ReportStatus = 
  | 'SUBMITTED'
  | 'ANALYZING'
  | 'VERIFIED'
  | 'ROUTED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'REJECTED'
  | 'CLOSED';

export type AuthorityType = 
  | 'RT'
  | 'RW'
  | 'KELURAHAN'
  | 'KECAMATAN'
  | 'DINAS_PU'
  | 'DINAS_BINA_MARGA'
  | 'DINAS_CIPTA_KARYA'
  | 'DINAS_PERHUBUNGAN'
  | 'BPBD'
  | 'POLISI'
  | 'PLN'
  | 'PDAM'
  | 'TELKOM'
  | 'OTHER';

export interface AIVisionAnalysis {
  damageType: DamageType;
  severity: Severity;
  confidence: number;
  details: {
    description: string;
    estimatedSize: string;
    estimatedDepth: string;
    riskFactors: string[];
    recommendedAction: string;
  };
  detectedObjects: DetectedObject[];
}

export interface DetectedObject {
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
}

export interface ReportCreateInput {
  title: string;
  description: string;
  damageType: DamageType;
  severity: Severity;
  latitude: number;
  longitude: number;
  address: string;
  images: string[];
}

export interface Authority {
  id: string;
  name: string;
  type: AuthorityType;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string;
  latitude: number;
  longitude: number;
  radius: number;
  isActive: boolean;
  contactPerson: string | null;
}

export interface AuthorityMatch {
  authority: Authority;
  distance: number;
  isWithinRadius: boolean;
}

export interface GuardrailResult {
  allowed: boolean;
  reason: string;
  sanitized: string;
  flags: string[];
}

export type GuardrailFlags = {
  injection: boolean;
  pii: boolean;
  toxicity: boolean;
  piiDetails: string[];
};

export interface Tool {
  name: string;
  description: string;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface AgentStep {
  thought: string;
  toolCalls: ToolCall[];
  observation: string;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

export interface AgentConfig {
  maxSteps: number;
  tools: Tool[];
  systemPrompt: string;
}

export interface AgentResult {
  answer: string;
  steps: AgentStep[];
  toolCalls: ToolCall[];
  duration: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    statusCode: number;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

export interface UserMemoryEntry {
  key: string;
  value: string;
  category: 'PREFERENCE' | 'TOPIC' | 'PATTERN';
}

export interface MemoryContext {
  userPreferences: Record<string, string>;
  frequentTopics: string[];
  recentInteractions: string[];
  commonAuthorities: string[];
}

export type NotificationType = 'EMAIL' | 'WHATSAPP' | 'SMS' | 'PUSH' | 'IN_APP';

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  reportId?: string;
  authorityId?: string;
  data?: Record<string, unknown>;
}

export interface WhatsAppMessage {
  to: string;
  template: string;
  parameters: string[];
}

export interface TraceSpan {
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
}

export interface AITrace {
  id: string;
  sessionId: string;
  userId: string;
  input: string;
  output: string;
  model: string;
  duration: number;
  confidence: number;
  guardrailFlags: GuardrailFlags;
  spans: TraceSpan[];
  createdAt: Date;
}

export interface AIMetrics {
  totalRequests: number;
  avgDuration: number;
  avgConfidence: number;
  errorRate: number;
  guardrailStats: {
    inputBlocked: number;
    outputSanitized: number;
    injectionDetected: number;
    piiDetected: number;
    toxicityDetected: number;
  };
  modelUsage: Record<string, number>;
}

export interface ChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: string;
  metadata?: {
    images?: string[];
    location?: { latitude: number; longitude: number };
    reportId?: string;
    aiAnalysis?: AIVisionAnalysis;
    toolCalls?: ToolCall[];
  };
  createdAt: Date;
}

export interface SessionSummary {
  id: string;
  title: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportResponse {
  id: string;
  reporterId?: string;
  assigneeId?: string | null;
  trackingCode: string;
  title: string;
  description: string;
  damageType: DamageType;
  severity: Severity;
  status: ReportStatus;
  latitude: number;
  longitude: number;
  address: string;
  images: string[];
  aiAnalysis: AIVisionAnalysis | null;
  aiConfidence: number | null;
  qrCode: string | null;
  authorityName: string;
  authorityContact: string | null;
  submittedAt: Date;
  verifiedAt: Date | null;
  routedAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  updates?: Array<{
    id: string;
    status: string;
    message: string;
    images: string[];
    createdAt: Date;
  }>;
}
