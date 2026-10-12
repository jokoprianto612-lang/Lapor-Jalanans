// Guardrails Service - Input/Output Safety Filtering
// Zero-dependency regex-based guardrails for injection, PII, toxicity

import type { GuardrailResult, GuardrailFlags } from '../types/index.js';

// ─────────────────────────────────────────────
// Injection Patterns
// ─────────────────────────────────────────────
const INJECTION_PATTERNS = [
  // Direct instruction override
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|directives?)/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|directives?)/i,
  /forget\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|directives?)/i,
  
  // System prompt extraction
  /system\s+prompt/i,
  /show\s+me\s+your\s+(system\s+)?prompt/i,
  /what\s+is\s+your\s+(system\s+)?prompt/i,
  /reveal\s+your\s+(system\s+)?prompt/i,
  /print\s+your\s+(system\s+)?prompt/i,
  
  // Role manipulation
  /you\s+are\s+now\s+(a\s+)?(different|new|another)\s+(person|character|role|agent)/i,
  /act\s+as\s+(a\s+)?(different|new|another)\s+(person|character|role|agent)/i,
  /pretend\s+to\s+be\s+(a\s+)?(different|new|another)\s+(person|character|role|agent)/i,
  /roleplay\s+as/i,
  
  // DAN / jailbreak variants
  /do\s+anything\s+now/i,
  /dan\s+mode/i,
  /developer\s+mode/i,
  /unrestricted\s+mode/i,
  /no\s+restrictions/i,
  /bypass\s+(safety|guidelines|filters?)/i,
  
  // Output manipulation
  /output\s+only\s+(the\s+)?(json|code|text)/i,
  /respond\s+only\s+(with|in)\s+(json|code|text)/i,
  /format\s+(your\s+)?(response|output)\s+as\s+(json|code)/i,
  
  // Chain of thought extraction
  /show\s+your\s+(reasoning|thinking|chain\s+of\s+thought)/i,
  /explain\s+your\s+(reasoning|thinking)/i,
  /step\s+by\s+step\s+(reasoning|thinking)/i,
];

// ─────────────────────────────────────────────
// PII Patterns (Indonesian context)
// ─────────────────────────────────────────────
const PII_PATTERNS = [
  // NIK - 16 digits
  { pattern: /\b\d{16}\b/g, label: 'NIK', replacement: '[NIK_REDACTED]' },
  
  // Indonesian phone numbers
  { pattern: /\b(08|628)\d{8,11}\b/g, label: 'PHONE', replacement: '[PHONE_REDACTED]' },
  { pattern: /\+62\s?8\d{8,11}/g, label: 'PHONE', replacement: '[PHONE_REDACTED]' },
  
  // Email
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, label: 'EMAIL', replacement: '[EMAIL_REDACTED]' },
  
  // NPWP - 15 digits (with or without dots/dashes)
  { pattern: /\b\d{2}\.?\d{3}\.?\d{3}\.?\d{1}\.?\d{3}\.?\d{3}\b/g, label: 'NPWP', replacement: '[NPWP_REDACTED]' },
  { pattern: /\b\d{15}\b/g, label: 'NPWP', replacement: '[NPWP_REDACTED]' },
  
  // Bank account (Indonesian banks typically 10-16 digits)
  { pattern: /\b\d{10,16}\b/g, label: 'BANK_ACCOUNT', replacement: '[ACCOUNT_REDACTED]' },
  
  // Credit card (basic pattern)
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, label: 'CREDIT_CARD', replacement: '[CARD_REDACTED]' },
  
  // KTP number variants
  { pattern: /\b\d{16}\b/g, label: 'KTP', replacement: '[KTP_REDACTED]' },
];

// ─────────────────────────────────────────────
// Toxicity Patterns (Indonesian + English)
// ─────────────────────────────────────────────
const TOXICITY_PATTERNS = [
  // Indonesian profanity
  /\b(anjing|babi|bangsat|bego|bodoh|brengsek|goblok|jancuk|kampret|kontol|memek|ngentot|sialan|tai|tolol)\b/gi,
  
  // English profanity
  /\b(fuck(?:ing)?|shit|bullshit|bitch|asshole|bastard|damn|hell|crap|piss)\b/gi,
  
  // Hate speech indicators
  /\b(kill|die|death|murder|suicide)\b/gi,
  /\b(bunuh|mati|bunuh diri)\b/gi,
  
  // Threats
  /\b(akan\s+bunuh|akan\s+matiin|gonna\s+kill|will\s+kill)\b/gi,
];

// ─────────────────────────────────────────────
// Output Policy Patterns (what LLM should not output)
// ─────────────────────────────────────────────
const OUTPUT_VIOLATION_PATTERNS = [
  // Prompt leaks
  /system\s+prompt/i,
  /my\s+instructions?\s+are/i,
  /i\s+was\s+told\s+to/i,
  /as\s+an\s+ai\s+(language\s+)?model/i,
  
  // Hallucination markers
  /i\s+don't\s+know/i,
  /i\s+cannot\s+(answer|help|provide)/i,
  /as\s+an\s+ai/i,
  
  // PII that might leak in output
  /\b\d{16}\b/,
  /\b(08|628)\d{8,11}\b/,
];

// ─────────────────────────────────────────────
// Guardrails Class
// ─────────────────────────────────────────────
export class Guardrails {
  private injectionPatterns: RegExp[];
  private piiPatterns: Array<{ pattern: RegExp; label: string; replacement: string }>;
  private toxicityPatterns: RegExp[];
  private outputViolationPatterns: RegExp[];

  constructor() {
    this.injectionPatterns = INJECTION_PATTERNS;
    this.piiPatterns = PII_PATTERNS;
    this.toxicityPatterns = TOXICITY_PATTERNS;
    this.outputViolationPatterns = OUTPUT_VIOLATION_PATTERNS;
  }

  // ─────────────────────────────────────────────
  // Input Guardrails
  // ─────────────────────────────────────────────
  
  /**
   * Check input for prompt injection attempts
   */
  checkInjection(input: string): { detected: boolean; patterns: string[] } {
    const detected: string[] = [];
    
    for (const pattern of this.injectionPatterns) {
      if (pattern.test(input)) {
        detected.push(pattern.source);
      }
    }
    
    return { detected: detected.length > 0, patterns: detected };
  }

  /**
   * Detect and redact PII from input
   */
  sanitizePII(input: string): { sanitized: string; detected: Array<{ label: string; count: number }> } {
    let sanitized = input;
    const detected: Array<{ label: string; count: number }> = [];
    
    for (const { pattern, label, replacement } of this.piiPatterns) {
      const matches = input.match(pattern);
      if (matches && matches.length > 0) {
        detected.push({ label, count: matches.length });
        sanitized = sanitized.replace(pattern, replacement);
      }
    }
    
    return { sanitized, detected };
  }

  /**
   * Check input for toxic content
   */
  checkToxicity(input: string): { detected: boolean; patterns: string[]; score: number } {
    const detected: string[] = [];
    let matchCount = 0;
    
    for (const pattern of this.toxicityPatterns) {
      const matches = input.match(pattern);
      if (matches && matches.length > 0) {
        detected.push(pattern.source);
        matchCount += matches.length;
      }
    }
    
    // Simple toxicity score: 0-1 based on matches per 100 chars
    const score = Math.min(matchCount / (input.length / 100), 1);
    
    return { detected: detected.length > 0, patterns: detected, score };
  }

  /**
   * Full input guardrail check
   */
  guardInput(input: string): GuardrailResult {
    const injection = this.checkInjection(input);
    const pii = this.sanitizePII(input);
    const toxicity = this.checkToxicity(input);
    
    const flags: string[] = [];
    if (injection.detected) flags.push('INJECTION');
    if (pii.detected.length > 0) flags.push('PII');
    if (toxicity.detected) flags.push('TOXICITY');
    
    // Block entirely if injection detected
    if (injection.detected) {
      return {
        allowed: false,
        reason: `Prompt injection detected: ${injection.patterns.join(', ')}`,
        sanitized: pii.sanitized,
        flags
      };
    }
    
    // Allow but flag toxicity and PII
    const reasonParts: string[] = [];
    if (pii.detected.length > 0) {
      reasonParts.push(`PII detected: ${pii.detected.map(d => `${d.label}(${d.count})`).join(', ')}`);
    }
    if (toxicity.detected) {
      reasonParts.push(`Toxicity detected (score: ${toxicity.score.toFixed(2)})`);
    }
    
    return {
      allowed: true,
      reason: reasonParts.length > 0 ? reasonParts.join('; ') : 'Clean input',
      sanitized: pii.sanitized,
      flags
    };
  }

  // ─────────────────────────────────────────────
  // Output Guardrails
  // ─────────────────────────────────────────────
  
  /**
   * Check LLM output for policy violations
   */
  guardOutput(output: string): GuardrailResult {
    const pii = this.sanitizePII(output);
    const violations: string[] = [];
    
    for (const pattern of this.outputViolationPatterns) {
      if (pattern.test(output)) {
        violations.push(pattern.source);
      }
    }
    
    const flags: string[] = [];
    if (pii.detected.length > 0) flags.push('PII_LEAK');
    if (violations.length > 0) flags.push('POLICY_VIOLATION');
    
    // Sanitize output but don't block - just flag
    return {
      allowed: true, // Always allow output, just sanitize
      reason: violations.length > 0 
        ? `Output policy violations: ${violations.join(', ')}` 
        : (pii.detected.length > 0 ? 'PII redacted from output' : 'Clean output'),
      sanitized: pii.sanitized,
      flags
    };
  }

  // ─────────────────────────────────────────────
  // Combined Check
  // ─────────────────────────────────────────────
  
  /**
   * Get structured flags for observability
   */
  getFlags(input: string, output?: string): GuardrailFlags {
    const injection = this.checkInjection(input);
    const pii = this.sanitizePII(input);
    const toxicity = this.checkToxicity(input);
    
    const flags: GuardrailFlags = {
      injection: injection.detected,
      pii: pii.detected.length > 0,
      toxicity: toxicity.detected,
      piiDetails: pii.detected.map(d => d.label)
    };
    
    if (output) {
      const outputGuard = this.guardOutput(output);
      if (outputGuard.flags.includes('PII_LEAK')) {
        flags.pii = true;
        flags.piiDetails.push('OUTPUT_PII_LEAK');
      }
      if (outputGuard.flags.includes('POLICY_VIOLATION')) {
        // Could add output_violation flag if needed
      }
    }
    
    return flags;
  }
}

// Singleton instance
export const guardrails = new Guardrails();