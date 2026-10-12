// Analysis Card Component - Display AI vision analysis results
'use client';

import { AIVisionAnalysis } from '@/types';
import { Card, Badge } from '@/components/ui';
import { AlertCircle, CheckCircle, Info, AlertTriangle, Ruler, Droplet, Zap, Shield } from 'lucide-react';
import { clsx } from 'clsx';

interface AnalysisCardProps {
  analysis: AIVisionAnalysis;
}

const severityConfig = {
  LOW: { color: 'success', icon: CheckCircle, label: 'Ringan' },
  MEDIUM: { color: 'warning', icon: AlertTriangle, label: 'Sedang' },
  HIGH: { color: 'danger', icon: AlertCircle, label: 'Berat' },
  CRITICAL: { color: 'danger', icon: Zap, label: 'Darurat' },
};

const damageTypeLabels: Record<string, string> = {
  POTHOLE: 'Lubang (Pothole)',
  CRACK: 'Retak (Crack)',
  SUBSIDENCE: 'Longsor/Subsidence',
  DRAINAGE: 'Masalah Drainase',
  SIGN_DAMAGE: 'Kerusakan Rambu',
  LIGHTING: 'Kerusakan Lampu Jalan',
  OTHER: 'Kerusakan Lainnya',
};

export function AnalysisCard({ analysis }: AnalysisCardProps) {
  // Defensive: handle cases where details might be missing
  const details = analysis.details ?? {
    description: 'Detail tidak tersedia',
    estimatedSize: '-',
    estimatedDepth: '-',
    riskFactors: [],
    recommendedAction: '-'
  };
  
  const severity = severityConfig[analysis.severity as keyof typeof severityConfig] || severityConfig.MEDIUM;
  const damageLabel = damageTypeLabels[analysis.damageType] || analysis.damageType;
  const confidencePercent = Math.round((analysis.confidence ?? 0) * 100);

  return (
    <Card className="border-l-4 border-l-primary-500 bg-primary-50/50 dark:bg-primary-900/10">
      <div className="flex items-start gap-3">
        <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', 
          `bg-${severity.color}-100 dark:bg-${severity.color}-900/30 text-${severity.color}-600 dark:text-${severity.color}-400`
        )}>
          <severity.icon className="w-5 h-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-secondary-900 dark:text-white">Analisis AI</span>
            <Badge variant={severity.color as any}>{severity.label}</Badge>
            <Badge variant="gray">{confidencePercent}% Keyakinan</Badge>
          </div>
          
          <p className="text-sm text-secondary-700 dark:text-secondary-300 mb-3">{damageLabel}</p>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 text-sm">
            <div className="flex items-center gap-1.5 text-secondary-600 dark:text-secondary-400">
              <Ruler className="w-4 h-4" />
              <span>{details.estimatedSize || '-'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-secondary-600 dark:text-secondary-400">
              <Droplet className="w-4 h-4" />
              <span>{details.estimatedDepth || '-'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-secondary-600 dark:text-secondary-400">
              <Info className="w-4 h-4" />
              <span>{details.recommendedAction?.substring(0, 30)}...</span>
            </div>
            <div className="flex items-center gap-1.5 text-secondary-600 dark:text-secondary-400">
              <Shield className="w-4 h-4" />
              <span>{details.riskFactors?.length || 0} Risiko</span>
            </div>
          </div>
          
          {/* Description */}
          <details className="group">
            <summary className="flex items-center gap-2 text-sm font-medium text-secondary-700 dark:text-secondary-300 cursor-pointer">
              <span>Detail Analisis</span>
              <svg className="w-4 h-4 transition-transform group-open:rotate-180 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="mt-3 space-y-3 text-sm text-secondary-600 dark:text-secondary-400">
              <p>{details.description}</p>
              
              {details.riskFactors && details.riskFactors.length > 0 && (
                <div>
                  <p className="font-medium text-secondary-700 dark:text-secondary-300 mb-1">Faktor Risiko:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {details.riskFactors.map((risk: string, idx: number) => (
                      <li key={idx}>{risk}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="p-3 bg-secondary-100 dark:bg-secondary-800 rounded-lg">
                <p className="font-medium text-secondary-700 dark:text-secondary-300 mb-1">Rekomendasi:</p>
                <p>{details.recommendedAction}</p>
              </div>
            </div>
          </details>
          
          {/* Detected Objects */}
          {analysis.detectedObjects && analysis.detectedObjects.length > 0 && (
            <details className="group mt-2">
              <summary className="flex items-center gap-2 text-sm font-medium text-secondary-700 dark:text-secondary-300 cursor-pointer">
                <span>Objek Terdeteksi ({analysis.detectedObjects.length})</span>
                <svg className="w-4 h-4 transition-transform group-open:rotate-180 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="mt-2 space-y-2">
                {analysis.detectedObjects.map((obj: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-secondary-50 dark:bg-secondary-800 rounded-lg">
                    <span className="text-sm font-medium text-secondary-900 dark:text-white capitalize">{obj.label}</span>
                    <Badge variant="gray" className="text-xs">
                      {Math.round(obj.confidence * 100)}%
                    </Badge>
                    <div className="flex-1 h-1.5 bg-secondary-200 dark:bg-secondary-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary-500 rounded-full transition-all duration-500"
                        style={{ width: `${obj.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </Card>
  );
}