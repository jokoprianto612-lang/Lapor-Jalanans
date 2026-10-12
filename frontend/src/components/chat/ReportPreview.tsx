// Report Preview Component - Preview before submitting formal report
'use client';

import { useState } from 'react';
import { Button, Card, Badge, Input, Textarea } from '@/components/ui';
import { MapPin, AlertCircle, CheckCircle, Camera, Send, X, Edit, Eye } from 'lucide-react';
import { clsx } from 'clsx';

interface ReportPreviewProps {
  report: any;
  onClose: () => void;
  onSubmit: () => void;
  onEdit?: () => void;
}

const severityConfig = {
  LOW: { color: 'success', label: 'Ringan' },
  MEDIUM: { color: 'warning', label: 'Sedang' },
  HIGH: { color: 'danger', label: 'Berat' },
  CRITICAL: { color: 'danger', label: 'Darurat' },
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

export function ReportPreview({ report, onClose, onSubmit, onEdit }: ReportPreviewProps) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: report.title || '',
    description: report.description || '',
    damageType: report.damageType || '',
    severity: report.severity || '',
    address: report.address || '',
  });

  const severity = severityConfig[report.severity as keyof typeof severityConfig] || severityConfig.MEDIUM;
  const damageLabel = damageTypeLabels[report.damageType] || report.damageType;

  const handleSubmit = () => {
    // Update report with edited data
    onSubmit();
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-secondary-200 dark:border-secondary-700 sticky top-0 bg-white dark:bg-secondary-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Pratinjau Laporan</h2>
              <p className="text-xs text-secondary-500">Periksa detail sebelum mengirim ke instansi</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Status Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant={severity.color as any}>{severity.label}</Badge>
            <Badge variant="primary">{damageLabel}</Badge>
            {report.trackingCode && (
              <Badge variant="gray">Kode: {report.trackingCode}</Badge>
            )}
          </div>

          {/* Images */}
          {report.images && report.images.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">Foto Kerusakan</h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {report.images.map((img: string, idx: number) => (
                  <div key={idx} className="relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden">
                    <img src={img} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Analysis */}
          {report.aiAnalysis && (
            <div className="border rounded-xl p-3 bg-primary-50/50 dark:bg-primary-900/10">
              <h3 className="text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2 flex items-center gap-2">
                <Camera className="w-4 h-4 text-primary-600" />
                Analisis AI
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-secondary-500">Jenis:</span>
                  <span className="ml-1 font-medium">{damageLabel}</span>
                </div>
                <div>
                  <span className="text-secondary-500">Keparahan:</span>
                  <Badge variant={severity.color as any} className="ml-1">{severity.label}</Badge>
                </div>
                <div>
                  <span className="text-secondary-500">Keyakinan:</span>
                  <span className="ml-1 font-medium">{Math.round((report.aiAnalysis.confidence || 0) * 100)}%</span>
                </div>
                <div>
                  <span className="text-secondary-500">Ukuran:</span>
                  <span className="ml-1">{report.aiAnalysis.details?.estimatedSize || '-'}</span>
                </div>
              </div>
              
              {report.aiAnalysis.details?.riskFactors && report.aiAnalysis.details.riskFactors.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs font-medium text-secondary-600 dark:text-secondary-400 cursor-pointer">Faktor Risiko</summary>
                  <ul className="list-disc list-inside text-xs text-secondary-600 dark:text-secondary-400 mt-1">
                    {report.aiAnalysis.details.riskFactors.map((risk: string, idx: number) => (
                      <li key={idx}>{risk}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {/* Location */}
          <div className="border rounded-xl p-3">
            <h3 className="text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Lokasi
            </h3>
            <p className="text-sm text-secondary-600 dark:text-secondary-400">{report.address}</p>
            <p className="text-xs text-secondary-500 mt-1">
              {report.latitude?.toFixed(6)}, {report.longitude?.toFixed(6)}
            </p>
          </div>

          {/* Authority */}
          {report.authorityName && (
            <div className="border rounded-xl p-3 bg-success-50 dark:bg-success-900/10 border-success-200 dark:border-success-800">
              <h3 className="text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success-600" />
                Instansi Tujuan
              </h3>
              <p className="font-medium text-secondary-900 dark:text-white">{report.authorityName}</p>
              {report.authorityContact && (
                <p className="text-xs text-secondary-500 mt-1">{report.authorityContact}</p>
              )}
            </div>
          )}

          {/* Form Fields (editable) */}
          {editing && (
            <div className="space-y-3 border-t border-secondary-200 dark:border-secondary-700 pt-4">
              <h3 className="text-sm font-medium text-secondary-700 dark:text-secondary-300">Edit Detail Laporan</h3>
              
              <Input
                label="Judul Laporan"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Contoh: Lubang besar di Jalan Sudirman"
              />
              
              <Textarea
                label="Deskripsi"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Deskripsi detail kerusakan..."
                rows={3}
              />
              
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={formData.damageType}
                  onChange={(e) => handleChange('damageType', e.target.value)}
                  className="input"
                >
                  <option value="">Pilih Jenis Kerusakan</option>
                  {Object.entries(damageTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                
                <select
                  value={formData.severity}
                  onChange={(e) => handleChange('severity', e.target.value)}
                  className="input"
                >
                  <option value="">Pilih Tingkat Keparahan</option>
                  <option value="LOW">Ringan</option>
                  <option value="MEDIUM">Sedang</option>
                  <option value="HIGH">Berat</option>
                  <option value="CRITICAL">Darurat</option>
                </select>
              </div>
              
              <Input
                label="Alamat Lengkap"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Nama jalan, RT/RW, Kelurahan, Kecamatan"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-secondary-200 dark:border-secondary-700">
            <Button variant="ghost" onClick={onClose}>
              <X className="w-4 h-4" />
              Batal
            </Button>
            
            {editing ? (
              <>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  <Eye className="w-4 h-4" />
                  Pratinjau
                </Button>
                <Button onClick={handleSubmit}>
                  <CheckCircle className="w-4 h-4" />
                  Simpan Perubahan
                </Button>
              </>
            ) : (
              <>
                {onEdit && (
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    <Edit className="w-4 h-4" />
                    Edit
                  </Button>
                )}
                <Button onClick={onSubmit}>
                  <Send className="w-4 h-4" />
                  Kirim Laporan
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}