import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import {signToken, setAuthCookie, verifyToken} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const cookieToken = req.cookies.get('auth_token')?.value;
    if (!cookieToken) {
      return error('UNAUTHORIZED', 'No session cookie', 401);
    }

    const payload = verifyToken(cookieToken);
    if (!payload) {
      return error('UNAUTHORIZED', 'Invalid session cookie', 401);
    }

    const dbUser = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!dbUser || dbUser.tokenVersion !== (payload as any).v) {
      return error('TOKEN_REVOKED', 'Session revoked, please login again', 401);
    }

    const token = signToken({ id: dbUser.id, email: dbUser.email, role: dbUser.role, authorityId: dbUser.authorityId || undefined, tokenVersion: dbUser.tokenVersion });
    const res = ok({ token });
    setAuthCookie(res, token);
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
