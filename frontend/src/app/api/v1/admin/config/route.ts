import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import {authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();
    if (!authUser.roles.includes('ADMIN')) return error('FORBIDDEN', 'Admin only', 403);

    const configs = await prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
    return ok({ configs });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();
    if (!authUser.roles.includes('ADMIN')) return error('FORBIDDEN', 'Admin only', 403);

    const data = await req.json();

    const config = await prisma.systemConfig.upsert({
      where: { key: data.key },
      update: { value: data.value, description: data.description },
      create: data,
    });

    return ok({ config });
  } catch (err) {
    return handleApiError(err);
  }
}
