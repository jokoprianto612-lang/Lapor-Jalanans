import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    name: 'Lapor Jalan',
    description: 'Sistem Pelaporan Kerusakan Infrastruktur Jalan Berbasis AI',
    version: '1.0.0',
    features: [
      'AI Vision Analysis untuk deteksi kerusakan',
      'Chat bot conversational untuk pelaporan',
      'Routing otomatis ke instansi berwenang',
      'Notifikasi WhatsApp/Email/SMS',
      'Tracking real-time dengan QR code',
      'PWA untuk offline reporting',
    ],
    damageTypes: [
      { value: 'POTHOLE', label: 'Lubang (Pothole)' },
      { value: 'CRACK', label: 'Retak (Crack)' },
      { value: 'SUBSIDENCE', label: 'Longsor/Subsidence' },
      { value: 'DRAINAGE', label: 'Masalah Drainase' },
      { value: 'SIGN_DAMAGE', label: 'Kerusakan Rambu' },
      { value: 'LIGHTING', label: 'Kerusakan Lampu Jalan' },
      { value: 'OTHER', label: 'Lainnya' },
    ],
    severityLevels: [
      { value: 'LOW', label: 'Ringan', color: '#22c55e' },
      { value: 'MEDIUM', label: 'Sedang', color: '#f59e0b' },
      { value: 'HIGH', label: 'Berat', color: '#ef4444' },
      { value: 'CRITICAL', label: 'Darurat', color: '#991b1b' },
    ],
    statuses: [
      { value: 'SUBMITTED', label: 'Dikirim' },
      { value: 'ANALYZING', label: 'Dianalisis AI' },
      { value: 'VERIFIED', label: 'Diverifikasi' },
      { value: 'ROUTED', label: 'Diteruskan ke Instansi' },
      { value: 'IN_PROGRESS', label: 'Sedang Dikerjakan' },
      { value: 'RESOLVED', label: 'Selesai' },
      { value: 'REJECTED', label: 'Ditolak' },
      { value: 'CLOSED', label: 'Ditutup' },
    ],
  });
}
