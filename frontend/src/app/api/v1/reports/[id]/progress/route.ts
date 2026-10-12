import { NextRequest } from 'next/server';
import {authenticate, unauthorized} from '@/lib/auth';
import {error, handleApiError, ok} from '@/lib/api-helpers';
import { addProgressUpdate } from '@/lib/services/report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return unauthorized();
    }

    if (!user.roles.includes('ADMIN') && !user.roles.includes('AUTHORITY_STAFF')) {
      return error('FORBIDDEN:_ADMIN_OR_AUTHORITY_STAFF_ACCESS_REQUIRED', 'Forbidden: Admin or Authority Staff access required', 403);
    }

    const body = await request.json();
    const { message, images } = body;

    if (!message || typeof message !== 'string' || message.length < 1 || message.length > 1000) {
      return error('MESSAGE_MUST_BE_A_STRING_BETWEEN_1_AND_1000_CHARACTERS', 'message must be a string between 1 and 1000 characters', 400);
    }

    if (images !== undefined && !Array.isArray(images)) {
      return error('IMAGES_MUST_BE_AN_ARRAY_OF_STRINGS', 'images must be an array of strings', 400);
    }

    const report = await addProgressUpdate(params.id, user.id, message, images);

    return ok({ report });
  } catch (err) {
    return handleApiError(err);
  }
}
