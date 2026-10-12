// Frontend Type Definitions
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  role: string;
  authorityId?: string;
}

export interface ChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: string;
  metadata?: {
    images?: string[];
    location?: { latitude: number; longitude: number };
    aiAnalysis?: AIVisionAnalysis;
    authorities?: AuthorityCardData[];
    toolCalls?: ToolCall[];
    reportId?: string;
    trackingCode?: string;
  };
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messageCount: number;
  lastMessage?: { role: string; content: string };
  createdAt: string;
  updatedAt: string;
}

export interface ToolCall {
  name: string;
  args: Record<string, any>;
  result?: any;
  error?: string;
}

export interface AIVisionAnalysis {
  damageType: string;
  severity: string;
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

export interface AuthorityCardData {
  authority: {
    id: string;
    name: string;
    type: string;
    email?: string;
    phone?: string;
    whatsapp?: string;
    address: string;
    contactPerson?: string;
  };
  distance: number;
  isWithinRadius: boolean;
  contactInfo: string;
  whatsappLink?: string;
  emailLink?: string;
}

export interface Report {
  id: string;
  trackingCode: string;
  title: string;
  description: string;
  damageType: string;
  severity: string;
  status: string;
  latitude: number;
  longitude: number;
  address: string;
  images: string[];
  aiAnalysis: AIVisionAnalysis | null;
  aiConfidence: number | null;
  qrCode: string | null;
  authorityName: string;
  authorityContact: string | null;
  submittedAt: string;
  verifiedAt: string | null;
  routedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  updates: ReportUpdate[];
}

export interface ReportUpdate {
  id: string;
  reportId: string;
  authorId: string;
  status: string;
  message: string;
  images: string[];
  createdAt: string;
  author?: { name: string };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    statusCode: number;
    details?: any;
  };
}

export interface PaginatedResponse<T> {
  reports: T[];
  total: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}