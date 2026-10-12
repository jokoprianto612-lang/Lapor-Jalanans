// API route helpers for Vercel serverless functions
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function ok(data: any, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

export function error(code: string, message: string, status: number, details?: any): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message, statusCode: status, ...(details && { details }) } },
    { status }
  );
}

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          statusCode: 400,
          details: err.issues,
        },
      },
      { status: 400 }
    );
  }

  const statusCode = (err as any)?.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : (err as Error)?.message || String(err);

  return NextResponse.json(
    {
      success: false,
      error: {
        code: (err as any)?.code || 'INTERNAL_ERROR',
        message,
        statusCode,
      },
    },
    { status: statusCode }
  );
}

export function notFound(): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found', statusCode: 404 } },
    { status: 404 }
  );
}
