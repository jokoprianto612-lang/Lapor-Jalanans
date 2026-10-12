// Auth helpers for Vercel API routes
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || '';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('FATAL: JWT_SECRET must be set and at least 32 chars');
}

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  authorityId?: string;
}

/** Sign a JWT. Payload is FLAT: { id, email, roles, authorityId?, v }. */
export function signToken(user: { id: string; email: string; role: string; authorityId?: string; tokenVersion: number }): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      roles: [user.role],
      ...(user.authorityId ? { authorityId: user.authorityId } : {}),
      v: user.tokenVersion,
    },
    JWT_SECRET,
    { expiresIn: '7d', algorithm: 'HS256' }
  );
}

/**
 * Verify JWT signature + expiry, then load the user from DB.
 *
 * The token carries `v` (tokenVersion). We re-read the DB on every request so
 * that:
 *   - changing a password (which increments tokenVersion) revokes old tokens
 *   - a role change takes effect immediately, not after the 7-day token expiry
 * Roles ALWAYS come from the DB row, never from the token body.
 *
 * Returns null when: no token, bad signature, expired, user deleted,
 * or tokenVersion mismatch (revoked).
 */
export async function verifyToken(token: string): Promise<AuthUser | null> {
  let payload: any;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }

  if (!payload?.id) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, role: true, authorityId: true, tokenVersion: true },
  });

  if (!dbUser) return null;
  if (dbUser.tokenVersion !== (payload.v ?? 0)) return null; // token revoked

  return {
    id: dbUser.id,
    email: dbUser.email,
    roles: [dbUser.role],
    authorityId: dbUser.authorityId || undefined,
  };
}

export function getTokenFromRequest(req: NextRequest): string | null {
  // Check Authorization header first
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  // Check cookie
  const cookieToken = req.cookies.get('auth_token')?.value;
  return cookieToken || null;
}

export function setAuthCookie(res: NextResponse, token: string): void {
  res.cookies.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
}

export function clearAuthCookie(res: NextResponse): void {
  res.cookies.set('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function authenticate(req: NextRequest): Promise<AuthUser | null> {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return verifyToken(token);
}

export function unauthorized(): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 } },
    { status: 401 }
  );
}

export function forbidden(): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'FORBIDDEN', message: 'Access denied', statusCode: 403 } },
    { status: 403 }
  );
}
