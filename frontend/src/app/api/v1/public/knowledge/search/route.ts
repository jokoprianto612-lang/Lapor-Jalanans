import { NextRequest } from 'next/server';
import { ragQuery } from '@/lib/services/rag';
import { ok, handleApiError } from '@/lib/api-helpers';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().min(1).max(20).default(5),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = querySchema.parse({
      q: searchParams.get('q') || '',
      limit: searchParams.get('limit') || undefined,
    });

    const results = await ragQuery(query.q, query.limit);
    return ok({ results });
  } catch (err) {
    return handleApiError(err);
  }
}
