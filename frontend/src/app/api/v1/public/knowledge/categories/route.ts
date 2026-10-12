import { NextResponse } from 'next/server';
import { getCategories } from '@/lib/services/rag';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const categories = getCategories();
  return NextResponse.json({ success: true, data: { categories } });
}
