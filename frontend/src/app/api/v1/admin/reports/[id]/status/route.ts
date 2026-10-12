import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import {authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();
    if (!authUser.roles.includes('ADMIN')) return error('FORBIDDEN', 'Admin only', 403);

    const data = z.object({
      status: z.enum(['SUBMITTED','ANALYZING','VERIFIED','ROUTED','IN_PROGRESS','RESOLVED','REJECTED','CLOSED']),
      message: z.string().min(1).max(1000),
    }).parse(await req.json());

    const report = await prisma.report.update({
      where: { id: params.id },
      data: { status: data.status },
      include: { reporter: true, assignee: true },
    });

    await prisma.reportUpdate.create({
      data: { reportId: params.id, authorId: authUser.id, status: data.status, message: data.message },
    });

    return ok({ report });
  } catch (err) {
    return handleApiError(err);
  }
}
