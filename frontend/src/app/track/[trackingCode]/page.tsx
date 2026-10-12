'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button, Card, Badge } from '@/components/ui';
import { publicApi } from '@/lib/api';
import { MapPin, CheckCircle, Clock, AlertCircle, XCircle, Loader2, Truck, Mail, MessageCircle, Phone, ExternalLink, QrCode as QRIcon } from 'lucide-react';
import { clsx } from 'clsx';
import QRCode from 'qrcode.react';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  SUBMITTED: { label: 'Dikirim', color: 'primary', icon: Clock },
  ANALYZING: { label: 'Dianalisis AI', color: 'primary', icon: Loader2 },
  VERIFIED: { label: 'Diverifikasi', color: 'success', icon: CheckCircle },
  ROUTED: { label: 'Diteruskan', color: 'warning', icon: Truck },
  IN_PROGRESS: { label: 'Dikerjakan', color: 'warning', icon: Truck },
  RESOLVED: { label: 'Selesai', color: 'success', icon: CheckCircle },
  REJECTED: { label: 'Ditolak', color: 'danger', icon: XCircle },
  CLOSED: { label: 'Ditutup', color: 'gray', icon: XCircle },
};

const damageTypeLabels: Record<string, string> = {
  POTHOLE: 'Lubang (Pothole)',
  CRACK: 'Retak (Crack)',
  SUBSIDENCE: 'Longsor/Subsidence',
  DRAINAGE: 'Masalah Drainase',
  SIGN_DAMAGE: 'Kerusakan Rambu',
  LIGHTING: 'Kerusakan Lampu Jalan',
  OTHER: 'Lainnya',
};

const severityLabels: Record<string, string> = {
  LOW: 'Ringan',
  MEDIUM: 'Sedang',
  HIGH: 'Berat',
  CRITICAL: 'Darurat',
};

export default function TrackPage() {
  const params = useParams();
  const trackingCode = params.trackingCode as string;
  
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const response = await publicApi.trackReport(trackingCode);
        setReport(response.data.data.report);
        
        // Generate QR code URL
        const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
        const trackUrl = `${frontendUrl}/track/${trackingCode}`;
        setQrCodeUrl(trackUrl);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'Laporan tidak ditemukan');
      } finally {
        setLoading(false);
      }
    };
    
    fetchReport();
  }, [trackingCode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary-50 dark:bg-secondary-900">
        <Card className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-secondary-600 dark:text-secondary-300">Memuat laporan...</p>
        </Card>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary-50 dark:bg-secondary-900 px-4">
        <Card className="w-full max-w-md p-8 text-center animate-in">
          <AlertCircle className="w-16 h-16 mx-auto text-danger-500 mb-4" />
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white mb-2">Laporan Tidak Ditemukan</h1>
          <p className="text-secondary-600 dark:text-secondary-300 mb-6">
            Kode tracking <code className="px-2 py-1 bg-secondary-100 dark:bg-secondary-800 rounded">{trackingCode}</code> tidak valid atau laporan telah dihapus.
          </p>
          <Button variant="primary" onClick={() => window.location.href = '/chat'}>
            Buat Laporan Baru
          </Button>
        </Card>
      </div>
    );
  }

  const status = statusConfig[report.status] || { label: report.status, color: 'gray', icon: AlertCircle };
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-secondary-900 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <Card className={clsx('border-l-4', `border-l-${status.color}-500`)}>
          <div className="p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-xl font-bold text-secondary-900 dark:text-white">{report.title}</h1>
                  <Badge variant={status.color as any} className="flex items-center gap-1">
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </Badge>
                </div>
                <p className="text-secondary-600 dark:text-secondary-300">Kode Tracking: <code className="px-2 py-1 bg-secondary-100 dark:bg-secondary-800 rounded font-mono text-primary-600">{report.trackingCode}</code></p>
              </div>
              {report.qrCode && (
                <div className="flex-shrink-0">
                  <QRCode value={qrCodeUrl} size={80} level="M" />
                  <p className="text-xs text-center text-secondary-500 mt-1">Scan untuk buka halaman ini</p>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2 text-secondary-600 dark:text-secondary-400">
                <MapPin className="w-4 h-4" />
                <span>{report.address}</span>
              </div>
              <div className="flex items-center gap-2 text-secondary-600 dark:text-secondary-400">
                <AlertCircle className="w-4 h-4" />
                <span>{damageTypeLabels[report.damageType] || report.damageType}</span>
              </div>
              <div className="flex items-center gap-2 text-secondary-600 dark:text-secondary-400">
                <Badge variant={severityLabels[report.severity] === 'Darurat' ? 'danger' : severityLabels[report.severity] === 'Berat' ? 'danger' : severityLabels[report.severity] === 'Sedang' ? 'warning' : 'success'}>{severityLabels[report.severity] || report.severity}</Badge>
              </div>
              <div className="flex items-center gap-2 text-secondary-600 dark:text-secondary-400">
                <Clock className="w-4 h-4" />
                <span>{formatDistanceToNow(new Date(report.submittedAt), { addSuffix: true, locale: id })}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Timeline */}
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Riwayat Status</h2>
            
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-secondary-200 dark:bg-secondary-700" />
              
              {[
                { status: 'SUBMITTED', label: 'Laporan Dikirim', time: report.submittedAt, completed: true },
                { status: 'ANALYZING', label: 'Dianalisis AI', time: report.verifiedAt, completed: ['ANALYZING', 'VERIFIED', 'ROUTED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(report.status) },
                { status: 'VERIFIED', label: 'Diverifikasi', time: report.verifiedAt, completed: ['VERIFIED', 'ROUTED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(report.status) },
                { status: 'ROUTED', label: 'Diteruskan ke Instansi', time: report.routedAt, completed: ['ROUTED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(report.status) },
                { status: 'IN_PROGRESS', label: 'Sedang Dikerjakan', time: null, completed: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(report.status) },
                { status: 'RESOLVED', label: 'Selesai', time: report.resolvedAt, completed: ['RESOLVED', 'CLOSED'].includes(report.status) },
                { status: 'CLOSED', label: 'Ditutup', time: report.closedAt, completed: report.status === 'CLOSED' },
              ].map((step, index) => (
                <div key={step.status} className="relative pl-12 pb-8 last:pb-0">
                  <div className={clsx('absolute left-4 top-1 w-3 h-3 rounded-full border-2', 
                    step.completed ? `bg-${statusConfig[step.status]?.color || 'gray'}-500 border-${statusConfig[step.status]?.color || 'gray'}-500` : 'bg-white border-secondary-300 dark:border-secondary-600'
                  )} />
                  <div className="flex items-start gap-3">
                    <div className={clsx('font-medium', step.completed ? 'text-secondary-900 dark:text-white' : 'text-secondary-400')}>
                      {step.label}
                    </div>
                    <div className="text-sm text-secondary-500">
                      {step.time ? formatDistanceToNow(new Date(step.time), { addSuffix: true, locale: id }) : 'Menunggu...'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Details */}
        <div className="grid gap-6">
          {/* AI Analysis */}
          {report.aiAnalysis && (
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  Analisis AI
                </h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-secondary-500">Jenis Kerusakan</p>
                    <p className="font-medium">{damageTypeLabels[report.aiAnalysis.damageType] || report.aiAnalysis.damageType}</p>
                  </div>
                  <div>
                    <p className="text-secondary-500">Tingkat Keparahan</p>
                    <Badge variant={statusConfig[report.aiAnalysis.severity]?.color as any}>{severityLabels[report.aiAnalysis.severity] || report.aiAnalysis.severity}</Badge>
                  </div>
                  <div>
                    <p className="text-secondary-500">Keyakinan AI</p>
                    <p className="font-medium">{Math.round((report.aiAnalysis.confidence || 0) * 100)}%</p>
                  </div>
                  <div>
                    <p className="text-secondary-500">Perkiraan Ukuran</p>
                    <p className="font-medium">{report.aiAnalysis.details?.estimatedSize || '-'}</p>
                  </div>
                </div>
                
                {report.aiAnalysis.details?.riskFactors && report.aiAnalysis.details.riskFactors.length > 0 && (
                  <details className="mt-4 group">
                    <summary className="font-medium text-secondary-700 dark:text-secondary-300 cursor-pointer flex items-center gap-2">
                      <span>Faktor Risiko ({report.aiAnalysis.details.riskFactors.length})</span>
                      <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                    </summary>
                    <ul className="list-disc list-inside mt-2 text-sm text-secondary-600 dark:text-secondary-400 space-y-1">
                      {report.aiAnalysis.details.riskFactors.map((risk: string, idx: number) => (
                        <li key={idx}>{risk}</li>
                      ))}
                    </ul>
                  </details>
                )}
                
                {report.aiAnalysis.details?.recommendedAction && (
                  <div className="mt-4 p-3 bg-secondary-100 dark:bg-secondary-800 rounded-lg">
                    <p className="font-medium text-secondary-700 dark:text-secondary-300 mb-1">Rekomendasi Tindakan:</p>
                    <p className="text-sm text-secondary-600 dark:text-secondary-400">{report.aiAnalysis.details.recommendedAction}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Photos */}
          {report.images && report.images.length > 0 && (
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Foto Kerusakan</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {report.images.map((img: string, idx: number) => (
                    <img key={idx} src={img} alt={`Foto ${idx + 1}`} className="w-full h-40 object-cover rounded-lg" loading="lazy" />
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Authority */}
          {report.authorityName && (
            <Card className="border-success-200 dark:border-success-800 bg-success-50 dark:bg-success-900/10">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-success-600" />
                  Instansi yang Menangani
                </h2>
                <p className="text-lg font-medium text-secondary-900 dark:text-white">{report.authorityName}</p>
                {report.authorityContact && (
                  <p className="text-secondary-600 dark:text-secondary-300 mt-1">{report.authorityContact}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {report.authorityContact && report.authorityContact.includes('08') && (
                    <a href={`https://wa.me/${report.authorityContact.replace(/\D/g, '')}?text=${encodeURIComponent(`Laporan ${report.trackingCode}: ${report.title}`)}`} target="_blank" rel="noopener noreferrer" className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm">
                      <MessageCircle className="w-4 h-4" />
                      Hubungi via WhatsApp
                    </a>
                  )}
                  <Button variant="outline" onClick={() => window.open(qrCodeUrl, '_blank')}>
                    <ExternalLink className="w-4 h-4" />
                    Buka Link Tracking
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Updates */}
          {report.updates && report.updates.length > 0 && (
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Update Progres</h2>
                <div className="space-y-4">
                  {report.updates.map((update: any, idx: number) => (
                    <div key={idx} className="border-l-2 border-secondary-200 dark:border-secondary-700 pl-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={statusConfig[update.status]?.color as any}>{statusConfig[update.status]?.label || update.status}</Badge>
                        <span className="text-sm text-secondary-500">{formatDistanceToNow(new Date(update.createdAt), { addSuffix: true, locale: id })}</span>
                      </div>
                      <p className="text-secondary-700 dark:text-secondary-300">{update.message}</p>
                      {update.images && update.images.length > 0 && (
                        <div className="mt-2 flex gap-2 overflow-x-auto">
                          {update.images.map((img: string, i: number) => (
                            <img key={i} src={img} alt={`Progress ${i + 1}`} className="h-20 w-auto object-cover rounded-lg" />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="primary" className="w-full sm:w-auto" onClick={() => window.open(qrCodeUrl, '_blank')}>
            <ExternalLink className="w-4 h-4" />
            Bagikan Link Tracking
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => window.location.href = '/chat'}>
            Buat Laporan Baru
          </Button>
        </div>
      </div>
    </div>
  );
}