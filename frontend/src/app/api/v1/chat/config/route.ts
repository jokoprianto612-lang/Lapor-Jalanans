import { NextRequest } from 'next/server';
import {authenticate, unauthorized} from '@/lib/auth';
import {handleApiError, ok} from '@/lib/api-helpers';
import { getAgentConfig } from '@/lib/services/agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return unauthorized();

    const config = getAgentConfig();
    return ok({ config: { maxSteps: config.maxSteps, tools: config.tools.map(t => t.name) } });
  } catch (err) {
    return handleApiError(err);
  }
}
