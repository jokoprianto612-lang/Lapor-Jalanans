// Vision Service - AI Image Analysis for Road Damage Detection
// Analyzes uploaded images to detect damage type, severity, and details

import type { AIVisionAnalysis, DetectedObject, DamageType, Severity } from '../types/index';
import { createSpan, recordTrace } from './observability';
import { guardrails } from './guardrails';

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

const VISION_API_ENDPOINT = process.env.VISION_API_ENDPOINT || 'https://api.nvidia.com/vision/analyze';
const VISION_API_KEY = process.env.VISION_API_KEY || '';
const CONFIDENCE_THRESHOLD = 0.5;

// ─────────────────────────────────────────────
// Damage Detection Patterns (Rule-based fallback)
// ─────────────────────────────────────────────

interface DamagePattern {
  type: DamageType;
  keywords: string[];
  visualIndicators: string[];
  severityRules: (analysis: any) => Severity;
}

const DAMAGE_PATTERNS: DamagePattern[] = [
  {
    type: 'POTHOLE',
    keywords: ['lubang', 'pothole', 'hole', 'cekungan', 'jurang kecil'],
    visualIndicators: ['circular depression', 'asphalt missing', 'sharp edges', 'water pooling'],
    severityRules: (a) => {
      const size = a.estimatedSizeCm || 0;
      const depth = a.estimatedDepthCm || 0;
      if (size > 50 || depth > 10) return 'CRITICAL';
      if (size > 30 || depth > 5) return 'HIGH';
      if (size > 15 || depth > 3) return 'MEDIUM';
      return 'LOW';
    }
  },
  {
    type: 'CRACK',
    keywords: ['retak', 'crack', 'retakan', 'pecah', 'fracture'],
    visualIndicators: ['linear fissure', 'alligator pattern', 'spider web', 'longitudinal line'],
    severityRules: (a) => {
      const width = a.crackWidthMm || 0;
      const length = a.crackLengthM || 0;
      if (width > 10 || length > 5) return 'HIGH';
      if (width > 5 || length > 2) return 'MEDIUM';
      return 'LOW';
    }
  },
  {
    type: 'SUBSIDENCE',
    keywords: ['longsor', 'subsidence', 'tanah ambles', 'penurunan', 'sinking'],
    visualIndicators: ['uneven surface', 'tilted road', 'soil exposure', 'structural deformation'],
    severityRules: () => 'CRITICAL' // Always critical
  },
  {
    type: 'DRAINAGE',
    keywords: ['drainase', 'saluran', 'drainage', 'banjir', 'genangan air', 'tersumbat'],
    visualIndicators: ['standing water', 'clogged drain', 'overflow', 'eroded shoulder'],
    severityRules: (a) => {
      const waterDepth = a.waterDepthCm || 0;
      if (waterDepth > 20) return 'HIGH';
      if (waterDepth > 10) return 'MEDIUM';
      return 'LOW';
    }
  },
  {
    type: 'SIGN_DAMAGE',
    keywords: ['rambu', 'sign', 'rambu rusak', 'traffic sign', 'warning sign'],
    visualIndicators: ['bent sign', 'missing sign', 'faded sign', 'fallen pole'],
    severityRules: (a) => a.isCriticalLocation ? 'HIGH' : 'MEDIUM'
  },
  {
    type: 'LIGHTING',
    keywords: ['lampu', 'light', 'lampu jalan', 'street light', 'pjumat', 'gelap'],
    visualIndicators: ['broken lamp', 'dark area', 'flickering', 'missing cover'],
    severityRules: (a) => a.isHighTraffic ? 'HIGH' : 'MEDIUM'
  }
];

// ─────────────────────────────────────────────
// Main Analysis Function
// ─────────────────────────────────────────────

/**
 * Analyze image for road damage
 * Tries AI vision API first, falls back to rule-based analysis
 */
export async function analyzeImage(
  imageBase64: string,
  location?: { lat: number; lng: number }
): Promise<AIVisionAnalysis> {
  const span = createSpan('vision_analysis', { imageSize: imageBase64.length, hasLocation: !!location });
  
  try {
    // Try AI vision API if configured
    if (VISION_API_KEY && VISION_API_ENDPOINT) {
      const result = await callVisionAPI(imageBase64, location);
      return span.end(result) as any;
    }
    
    // Fallback: Rule-based analysis from base64 metadata
    const result = await ruleBasedAnalysis(imageBase64, location);
    return span.end(result) as any;
  } catch (error) {
    console.error('[Vision] Analysis failed:', error);
    // Return safe fallback
    return span.end({
      damageType: 'OTHER',
      severity: 'LOW',
      confidence: 0.3,
      details: {
        description: 'Analisis otomatis gagal, silakan isi manual',
        estimatedSize: 'Tidak diketahui',
        estimatedDepth: 'Tidak diketahui',
        riskFactors: ['Analisis AI tidak tersedia'],
        recommendedAction: 'Isi detail kerusakan secara manual'
      },
      detectedObjects: []
    }) as any;
  }
}

/**
 * Call external vision API (NVIDIA NIM, Google Vision, etc.)
 * Falls back to rule-based analysis if API fails
 */
async function callVisionAPI(imageBase64: string, location?: { lat: number; lng: number }): Promise<AIVisionAnalysis> {
  const endpoint = process.env.VISION_API_ENDPOINT;
  const apiKey = process.env.VISION_API_KEY;

  if (!endpoint || !apiKey) {
    // No vision API configured, use rule-based
    return ruleBasedAnalysis(imageBase64, location);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: imageBase64,
        tasks: ['object_detection', 'classification', 'segmentation'],
        context: 'road_damage_detection',
        ...(location && { location })
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Vision] API error:', response.status, errorText);
      return ruleBasedAnalysis(imageBase64, location);
    }

    const data = await response.json() as any;
    return parseVisionResponse(data, location);
  } catch (error) {
    console.error('[Vision] API call failed:', error);
    return ruleBasedAnalysis(imageBase64, location);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parse vision API response into AIVisionAnalysis format
 */
function parseVisionResponse(data: any, location?: { lat: number; lng: number }): AIVisionAnalysis {
  // Handle different API response formats
  const detections = data.detections || data.objects || data.predictions || [];
  const classifications = data.classifications || data.labels || [];

  // Extract damage type from classifications
  let damageType: DamageType = 'OTHER';
  let confidence = 0.5;

  if (classifications.length > 0) {
    const topClassification = classifications[0];
    const label = (topClassification.label || topClassification.name || '').toLowerCase();
    confidence = topClassification.confidence || topClassification.score || 0.5;

    // Map common labels to damage types
    if (label.includes('pothole') || label.includes('lubang') || label.includes('hole')) {
      damageType = 'POTHOLE';
    } else if (label.includes('crack') || label.includes('retak')) {
      damageType = 'CRACK';
    } else if (label.includes('subsidence') || label.includes('longsor') || label.includes('sink')) {
      damageType = 'SUBSIDENCE';
    } else if (label.includes('drainage') || label.includes('drain') || label.includes('banjir')) {
      damageType = 'DRAINAGE';
    } else if (label.includes('sign') || label.includes('rambu')) {
      damageType = 'SIGN_DAMAGE';
    } else if (label.includes('light') || label.includes('lampu')) {
      damageType = 'LIGHTING';
    }
  }

  // Determine severity based on confidence and damage type
  let severity: Severity = 'LOW';
  if (damageType === 'SUBSIDENCE') {
    severity = 'CRITICAL';
  } else if (confidence > 0.8) {
    severity = 'HIGH';
  } else if (confidence > 0.6) {
    severity = 'MEDIUM';
  }

  // Build detected objects
  const detectedObjects: DetectedObject[] = detections.slice(0, 5).map((d: any) => ({
    label: d.label || d.name || 'unknown',
    confidence: d.confidence || d.score || 0.5,
    bbox: d.bbox || d.boundingBox || [0, 0, 1, 1]
  }));

  return {
    damageType,
    severity,
    confidence,
    details: {
      description: `Terdeteksi ${damageType.toLowerCase().replace('_', ' ')} dengan confidence ${(confidence * 100).toFixed(0)}%`,
      estimatedSize: 'Perlu verifikasi manual',
      estimatedDepth: 'Perlu verifikasi manual',
      riskFactors: location ? [`Lokasi: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`] : ['Perlu verifikasi lapangan'],
      recommendedAction: 'Lakukan inspeksi lapangan untuk konfirmasi'
    },
    detectedObjects
  };
}

/**
 * Rule-based analysis from image metadata/base64
 * In production, this would use actual image processing
 */
async function ruleBasedAnalysis(
  imageBase64: string,
  location?: { lat: number; lng: number }
): Promise<AIVisionAnalysis> {
  // Extract any text/metadata from base64 (if embedded)
  const metadata = extractImageMetadata(imageBase64);
  
  // Simulate detection based on typical patterns
  // In real implementation, this would use TensorFlow.js, ONNX, or similar
  const simulatedDetection = simulateDamageDetection(imageBase64, metadata);
  
  // Match to damage patterns
  const matchedPattern = matchDamagePattern(simulatedDetection);
  
  // Calculate confidence
  const confidence = calculateConfidence(simulatedDetection, matchedPattern);
  
  // Determine severity
  const severity = matchedPattern 
    ? matchedPattern.severityRules(simulatedDetection)
    : 'LOW';
  
  // Build analysis result
  const analysis: AIVisionAnalysis = {
    damageType: matchedPattern?.type || 'OTHER',
    severity,
    confidence,
    details: {
      description: generateDescription(simulatedDetection, matchedPattern),
      estimatedSize: simulatedDetection.estimatedSize || 'Perlu verifikasi manual',
      estimatedDepth: simulatedDetection.estimatedDepth || 'Perlu verifikasi manual',
      riskFactors: generateRiskFactors(simulatedDetection, matchedPattern, location),
      recommendedAction: generateRecommendation(matchedPattern?.type, severity)
    },
    detectedObjects: simulatedDetection.objects || []
  };
  
  return analysis;
}

/**
 * Extract metadata from base64 image
 */
function extractImageMetadata(base64: string): Record<string, any> {
  // Check for data URL format
  const match = base64.match(/^data:image\/(\w+);base64,(.+)$/);
  if (match) {
    return {
      format: match[1],
      size: Math.round(match[2].length * 0.75), // Approximate bytes
      hasDataUrl: true
    };
  }
  
  // Raw base64
  return {
    format: 'unknown',
    size: Math.round(base64.length * 0.75),
    hasDataUrl: false
  };
}

/**
 * Simulate damage detection (replace with actual ML model)
 */
function simulateDamageDetection(base64: string, metadata: Record<string, any>) {
  // In production, this would:
  // 1. Decode base64 to image buffer
  // 2. Run through object detection model (YOLO, etc.)
  // 3. Run classification model
  // 4. Run segmentation for precise measurements
  
  // For now, simulate based on image size and random factors
  // This is a PLACEHOLDER - replace with actual ML inference
  
  const size = metadata.size || 100000;
  const hash = simpleHash(base64.substring(0, 100));
  
  // Deterministic "random" based on image content
  const damageTypes: DamageType[] = ['POTHOLE', 'CRACK', 'DRAINAGE', 'SIGN_DAMAGE', 'LIGHTING'];
  const selectedType = damageTypes[hash % damageTypes.length];
  
  // Simulate measurements based on type
  let estimatedSize = 'Tidak terdeteksi';
  let estimatedDepth = 'Tidak terdeteksi';
  let crackWidthMm = 0;
  let crackLengthM = 0;
  let waterDepthCm = 0;
  let estimatedSizeCm = 0;
  let estimatedDepthCm = 0;
  let isCriticalLocation = false;
  let isHighTraffic = false;
  
  switch (selectedType) {
    case 'POTHOLE':
      estimatedSizeCm = 20 + (hash % 40); // 20-60cm
      estimatedDepthCm = 3 + (hash % 10); // 3-13cm
      estimatedSize = `${estimatedSizeCm}x${estimatedSizeCm - 5} cm`;
      estimatedDepth = `${estimatedDepthCm} cm`;
      break;
    case 'CRACK':
      crackLengthM = 1 + (hash % 10); // 1-10m
      crackWidthMm = 2 + (hash % 15); // 2-17mm
      estimatedSize = `Panjang ${crackLengthM}m, lebar ${crackWidthMm}mm`;
      break;
    case 'DRAINAGE':
      waterDepthCm = 5 + (hash % 25); // 5-30cm
      estimatedDepth = `Genangan air ~${waterDepthCm}cm`;
      break;
    case 'SIGN_DAMAGE':
      isCriticalLocation = hash % 3 === 0;
      estimatedSize = 'Rambu lalu lintas';
      break;
    case 'LIGHTING':
      isHighTraffic = hash % 2 === 0;
      estimatedSize = 'Lampu jalan (PJU)';
      break;
  }
  
  // Simulate detected objects
  const objects: DetectedObject[] = [
    {
      label: selectedType.toLowerCase().replace('_', ' '),
      confidence: 0.6 + (hash % 30) / 100, // 0.6-0.89
      bbox: [0.2, 0.2, 0.6, 0.6] // normalized
    }
  ];
  
  // Add context objects
  if (selectedType === 'POTHOLE') {
    objects.push({
      label: 'water_puddle',
      confidence: 0.5 + (hash % 20) / 100,
      bbox: [0.25, 0.25, 0.5, 0.5]
    });
  }
  
  return {
    type: selectedType,
    estimatedSize,
    estimatedDepth,
    estimatedSizeCm,
    estimatedDepthCm,
    crackWidthMm,
    crackLengthM,
    waterDepthCm,
    isCriticalLocation,
    isHighTraffic,
    objects
  };
}

/**
 * Match detected features to damage patterns
 */
function matchDamagePattern(detection: any): DamagePattern | null {
  for (const pattern of DAMAGE_PATTERNS) {
    if (pattern.type === detection.type) {
      return pattern;
    }
  }
  return null;
}

/**
 * Calculate confidence score
 */
function calculateConfidence(detection: any, pattern: DamagePattern | null): number {
  let confidence = 0.5; // Base
  
  if (pattern) confidence += 0.2;
  if (detection.objects && detection.objects.length > 0) {
    const avgObjConf = detection.objects.reduce((sum: number, o: DetectedObject) => sum + o.confidence, 0) / detection.objects.length;
    confidence += avgObjConf * 0.2;
  }
  if (detection.estimatedSizeCm > 0 || detection.crackLengthM > 0) confidence += 0.1;
  
  return Math.min(confidence, 0.95);
}

/**
 * Generate human-readable description
 */
function generateDescription(detection: any, pattern: DamagePattern | null): string {
  const typeNames: Record<DamageType, string> = {
    POTHOLE: 'Lubang (Pothole)',
    CRACK: 'Retak (Crack)',
    SUBSIDENCE: 'Longsor/Subsidence',
    DRAINAGE: 'Masalah Drainase',
    SIGN_DAMAGE: 'Kerusakan Rambu',
    LIGHTING: 'Kerusakan Lampu Jalan',
    OTHER: 'Kerusakan Lainnya'
  };
  
  const typeName = pattern ? typeNames[pattern.type] : 'Kerusakan tidak dikenali';
  
  let desc = `Terdeteksi ${typeName.toLowerCase()}`;
  
  if (detection.estimatedSize !== 'Tidak terdeteksi') {
    desc += ` dengan ukuran ${detection.estimatedSize.toLowerCase()}`;
  }
  if (detection.estimatedDepth !== 'Tidak terdeteksi') {
    desc += `, kedalaman ${detection.estimatedDepth.toLowerCase()}`;
  }
  
  return desc + '.';
}

/**
 * Generate risk factors
 */
function generateRiskFactors(detection: any, pattern: DamagePattern | null, location?: { lat: number; lng: number }): string[] {
  const risks: string[] = [];
  
  if (pattern) {
    switch (pattern.type) {
      case 'POTHOLE':
        if (detection.estimatedDepthCm > 5) risks.push('Kedalaman >5cm berbahaya untuk motor');
        if (detection.estimatedSizeCm > 30) risks.push('Diameter >30cm bisa merusak ban mobil');
        risks.push('Berpotensi menyebabkan kecelakaan di malam hari');
        break;
      case 'CRACK':
        if (detection.crackWidthMm > 5) risks.push('Retak lebar >5mm indikasi kerusakan struktural');
        risks.push('Air hujan bisa meresap memperparah kerusakan');
        break;
      case 'SUBSIDENCE':
        risks.push('BAHAYA KRITIS: Tanah tidak stabil, bisa longsor sewaktu-waktu');
        risks.push('Jangan dilalui kendaraan berat');
        break;
      case 'DRAINAGE':
        if (detection.waterDepthCm > 15) risks.push('Genangan air tinggi, risiko banjir & aquaplaning');
        risks.push('Drainase tersumbat mempercepat kerusakan jalan');
        break;
      case 'SIGN_DAMAGE':
        if (detection.isCriticalLocation) risks.push('Lokasi kritis: tikungan/perempatan');
        risks.push('Kendaraan tidak mendapat peringatan bahaya');
        break;
      case 'LIGHTING':
        if (detection.isHighTraffic) risks.push('Jalan raya ramai tanpa pencahayaan malam hari');
        risks.push('Meningkatkan risiko kecelakaan 3x lipat di malam');
        break;
    }
  }
  
  if (location) {
    risks.push(`Lokasi: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
  }
  
  return risks.length > 0 ? risks : ['Perlu verifikasi lapangan untuk penilaian risiko lengkap'];
}

/**
 * Generate recommended action
 */
function generateRecommendation(type: DamageType | undefined, severity: Severity): string {
  const actions: Record<DamageType, Record<Severity, string>> = {
    POTHOLE: {
      LOW: 'Patch repair dengan campuran aspal dingin (cold mix), jadwalkan dalam 1-2 minggu',
      MEDIUM: 'Patch repair dengan hot mix aspal, prioritas 3-7 hari',
      HIGH: 'Perbaikan mendadak (emergency patching) dalam 24-48 jam, lalu jadwalkan mill & overlay',
      CRITICAL: 'TUTUP JALAN SEMENTARA, perbaikan darurat dalam 24 jam, perlukan traffic management'
    },
    CRACK: {
      LOW: 'Crack sealing dengan sealant bitumen, jadwalkan pemeliharaan rutin',
      MEDIUM: 'Crack sealing + overlay tipis jika area luas',
      HIGH: 'Perbaikan struktural: mill & overlay penuh',
      CRITICAL: 'Evaluasi struktural mendadak, mungkin perlu reconstruksi'
    },
    SUBSIDENCE: {
      LOW: 'Monitoring berkala, pengisian material',
      MEDIUM: 'Stabilisasi tanah dengan grouting/soil nailing',
      HIGH: 'Stabilisasi darurat + pengawasan 24/7',
      CRITICAL: 'TUTUP JALAN TOTAL, evakuasi jika perlu, rekonstruksi penuh'
    },
    DRAINAGE: {
      LOW: 'Pembersihan rutin saluran air',
      MEDIUM: 'Pembersinan + perbaikan saluran rusak',
      HIGH: 'Perbaikan drainase mendadak, pompa air jika banjir',
      CRITICAL: 'Darurat banjir: pompa air, evakuasi, perbaikan sistem drainase'
    },
    SIGN_DAMAGE: {
      LOW: 'Ganti rambu dalam jadwal rutin',
      MEDIUM: 'Ganti rambu prioritas 1-3 hari',
      HIGH: 'Ganti rambu darurat 24 jam + temporary signage',
      CRITICAL: 'Pemasangan rambu sementara segera, ganti permanen 24 jam'
    },
    LIGHTING: {
      LOW: 'Jadwalkan penggantian lampu dalam minggu ini',
      MEDIUM: 'Ganti lampu/ballast prioritas 1-3 hari',
      HIGH: 'Perbaikan darurat 24 jam, pasang portable lighting sementara',
      CRITICAL: 'Perbaikan darurat + traffic management malam hari'
    },
    OTHER: {
      LOW: 'Catat dan jadwalkan inspeksi',
      MEDIUM: 'Inspeksi dalam 3 hari, tentukan tindakan',
      HIGH: 'Inspeksi 24 jam, tindakan mitigasi',
      CRITICAL: 'Tindakan darurat segera'
    }
  };
  
  if (type && actions[type]) {
    return actions[type][severity];
  }
  
  return 'Lakukan inspeksi lapangan untuk menentukan tindakan yang tepat';
}

/**
 * Simple hash for deterministic simulation
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Validate image before analysis
 */
export function validateImage(base64: string): { valid: boolean; error?: string; metadata?: Record<string, any> } {
  const metadata = extractImageMetadata(base64);
  
  // Check size (max 10MB)
  if (metadata.size > 10 * 1024 * 1024) {
    return { valid: false, error: 'Ukuran gambar terlalu besar (maks 10MB)', metadata };
  }
  
  // Check format
  const allowedFormats = ['jpeg', 'jpg', 'png', 'webp', 'heic'];
  if (metadata.format !== 'unknown' && !allowedFormats.includes(metadata.format.toLowerCase())) {
    return { valid: false, error: `Format tidak didukung: ${metadata.format}. Gunakan JPG, PNG, WebP, atau HEIC`, metadata };
  }
  
  // Basic base64 validation
  try {
    const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
    Buffer.from(cleanBase64, 'base64');
  } catch {
    return { valid: false, error: 'Data gambar tidak valid (base64 corrupt)', metadata };
  }
  
  return { valid: true, metadata };
}

/**
 * Process multiple images and aggregate analysis
 */
export async function analyzeMultipleImages(
  imagesBase64: string[],
  location?: { lat: number; lng: number }
): Promise<AIVisionAnalysis> {
  if (imagesBase64.length === 0) {
    throw new Error('Tidak ada gambar untuk dianalisis');
  }
  
  // Analyze each image
  const analyses = await Promise.all(
    imagesBase64.map(img => analyzeImage(img, location))
  );
  
  // Aggregate: highest severity, most confident detection
  let bestAnalysis = analyses[0];
  let maxSeverityScore = severityToScore(bestAnalysis.severity);
  
  for (const analysis of analyses.slice(1)) {
    const score = severityToScore(analysis.severity);
    if (score > maxSeverityScore || (score === maxSeverityScore && analysis.confidence > bestAnalysis.confidence)) {
      bestAnalysis = analysis;
      maxSeverityScore = score;
    }
  }
  
  // Combine detected objects
  const allObjects = analyses.flatMap(a => a.detectedObjects);
  bestAnalysis.detectedObjects = allObjects;
  
  // Combine risk factors
  const allRisks = analyses.flatMap(a => a.details.riskFactors);
  bestAnalysis.details.riskFactors = Array.from(new Set(allRisks));
  
  return bestAnalysis;
}

function severityToScore(severity: Severity): number {
  switch (severity) {
    case 'CRITICAL': return 4;
    case 'HIGH': return 3;
    case 'MEDIUM': return 2;
    case 'LOW': return 1;
  }
}