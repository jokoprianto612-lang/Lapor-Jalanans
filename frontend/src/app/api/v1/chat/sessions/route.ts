import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import {authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const newSessionSchema = z.object({
  title: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();

    const data = newSessionSchema.parse(await req.json());

    const session = await prisma.session.create({
      data: {
        userId: authUser.id,
        title: data.title || 'Laporan Baru',
      },
    });

    return ok({ session: { id: session.id, title: session.title, createdAt: session.createdAt } }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where: { userId: authUser.id },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          _count: { select: { messages: true } },
        },
      }),
      prisma.session.count({ where: { userId: authUser.id } }),
    ]);

    return ok({
      sessions: sessions.map((s: any) => ({
        id: s.id,
        title: s.title,
        messageCount: s._count.messages,
        lastMessage: s.messages[0] ? { role: s.messages[0].role, content: s.messages[0].content.substring(0, 100) } : null,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      total,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
