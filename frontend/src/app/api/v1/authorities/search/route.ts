import { NextRequest } from 'next/server';
import { z } from 'zod';
import {authenticate, unauthorized} from '@/lib/auth';
import {handleApiError, ok} from '@/lib/api-helpers';
import { searchAuthorities } from '@/lib/services/authority';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const searchSchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export async function GET(req: NextRequest) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();

    const { searchParams } = new URL(req.url);
    const query = searchSchema.parse({
      q: searchParams.get('q') || '',
      limit: searchParams.get('limit') || undefined,
    });

    const authorities = await searchAuthorities(query.q);
    return ok({ authorities: authorities.slice(0, query.limit) });
  } catch (err) {
    return handleApiError(err);
  }
}
