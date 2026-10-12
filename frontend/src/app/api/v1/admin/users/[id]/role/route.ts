import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import {authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateRoleSchema = z.object({
  role: z.enum(['CITIZEN', 'ADMIN', 'AUTHORITY_STAFF']),
  authorityId: z.string().uuid().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();
    if (!authUser.roles.includes('ADMIN')) return error('FORBIDDEN', 'Admin only', 403);

    const data = updateRoleSchema.parse(await req.json());

    const user = await prisma.user.update({
      where: { id: params.id },
      data: { role: data.role, authorityId: data.authorityId || null },
      select: { id: true, email: true, name: true, role: true, authorityId: true },
    });

    return ok({ user });
  } catch (err) {
    return handleApiError(err);
  }
}
