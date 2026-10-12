import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth';
import { ok } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const res = ok({ message: 'Logged out successfully' });
  clearAuthCookie(res);
  return res;
}
