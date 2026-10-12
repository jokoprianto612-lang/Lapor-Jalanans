import { NextRequest } from 'next/server';
import { getDocumentsByCategory } from '@/lib/services/rag';
import { ok, handleApiError } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { category: string } }) {
  try {
    const documents = getDocumentsByCategory(params.category);
    return ok({ documents });
  } catch (err) {
    return handleApiError(err);
  }
}
