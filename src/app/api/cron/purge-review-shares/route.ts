import { NextRequest, NextResponse } from 'next/server';
import { deleteExpiredReviewShares } from '@/lib/research-storage';
import { reviewSharingConfigured } from '@/lib/research-sharing';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!reviewSharingConfigured()) return NextResponse.json({ error: 'Review storage is not configured' }, { status: 503 });
  try {
    await deleteExpiredReviewShares(new Date());
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Review expiry cleanup failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Expiry cleanup failed' }, { status: 502 });
  }
}
