import { NextRequest } from 'next/server';
import { authenticate, unauthorized } from '@/lib/auth';
import { ok, error, handleApiError } from '@/lib/api-helpers';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: { key: string } }) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();
    if (!authUser.roles.includes('ADMIN')) return error('FORBIDDEN', 'Admin only', 403);

    const existing = await prisma.systemConfig.findUnique({
      where: { key: params.key },
    });

    if (!existing) return error('NOT_FOUND', 'Config tidak ditemukan', 404);

    await prisma.systemConfig.delete({
      where: { key: params.key },
    });

    return ok({ message: 'Config berhasil dihapus' });
  } catch (err) {
    return handleApiError(err);
  }
}
