import { NextRequest } from 'next/server';
import {authenticate, unauthorized} from '@/lib/auth';
import {handleApiError, ok} from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();

    const types = [
      { value: 'RT', label: 'RT (Rukun Tetangga)', description: 'Tingkat terkecil, lingkungan langsung' },
      { value: 'RW', label: 'RW (Rukun Warga)', description: 'Beberapa RT, koordinasi lingkungan' },
      { value: 'KELURAHAN', label: 'Kelurahan/Desa', description: 'Pemerintah desa/kelurahan' },
      { value: 'KECAMATAN', label: 'Kecamatan', description: 'Pemerintah kecamatan' },
      { value: 'DINAS_PU', label: 'Dinas Pekerjaan Umum', description: 'Bidang pekerjaan umum & tata ruang' },
      { value: 'DINAS_BINA_MARGA', label: 'Dinas Bina Marga', description: 'Khusus jalan & jembatan' },
      { value: 'POLISI', label: 'Polisi (Ditlantas)', description: 'Lalu lintas & keamanan jalan' },
      { value: 'PLN', label: 'PLN', description: 'Listrik & lampu jalan (PJU)' },
      { value: 'PDAM', label: 'PDAM', description: 'Air bersih & drainase' },
      { value: 'TELKOM', label: 'Telkom/ISP', description: 'Telekomunikasi & kabel' },
      { value: 'OTHER', label: 'Lainnya', description: 'Instansi lain' },
    ];

    return ok({ types });
  } catch (err) {
    return handleApiError(err);
  }
}
