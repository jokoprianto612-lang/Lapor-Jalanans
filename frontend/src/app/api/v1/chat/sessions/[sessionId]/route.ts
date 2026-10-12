import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import {authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();

    const { sessionId } = params;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before');

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== authUser.id) {
      return error('NOT_FOUND', 'Sesi tidak ditemukan', 404);
    }

    const where: any = { sessionId };
    if (before) where.createdAt = { lt: new Date(before) };

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return ok({
      session: { id: session.id, title: session.title },
      messages: messages.reverse().map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        metadata: m.metadata,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();

    const { sessionId } = params;

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== authUser.id) {
      return error('NOT_FOUND', 'Sesi tidak ditemukan', 404);
    }

    await prisma.session.delete({ where: { id: sessionId } });

    return ok({ message: 'Sesi dihapus' });
  } catch (err) {
    return handleApiError(err);
  }
}
