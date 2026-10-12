import { NextRequest } from 'next/server';
import { ok } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  return ok({
    csrf_token: 'not-needed',
    message: 'CSRF not used in this deployment',
  });
}
