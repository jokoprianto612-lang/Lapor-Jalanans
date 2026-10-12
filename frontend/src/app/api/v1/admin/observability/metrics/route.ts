import { NextRequest } from 'next/server';
import {authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';
import { computeMetrics } from '@/lib/services/observability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();
    if (!authUser.roles.includes('ADMIN')) return error('FORBIDDEN', 'Admin only', 403);

    const { searchParams } = new URL(req.url);
    const window = searchParams.get('window') || '24h';

    const windowMs = parseWindow(window);
    const metrics = computeMetrics(windowMs);

    return ok({ metrics, window });
  } catch (err) {
    return handleApiError(err);
  }
}

function parseWindow(window: string): number {
  const match = window.match(/^(\d+)([hmd])$/);
  if (!match) return 24 * 60 * 60 * 1000;

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'm': return value * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}
