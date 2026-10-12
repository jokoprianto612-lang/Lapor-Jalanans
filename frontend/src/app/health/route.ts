// Endpoint healthcheck untuk Docker HEALTHCHECK & load balancer.
// Dockerfile prod memakai wget http://localhost:3000/health — route ini yang menjawab.
import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({ status: 'ok', service: 'lapor-jalan-frontend' });
}
