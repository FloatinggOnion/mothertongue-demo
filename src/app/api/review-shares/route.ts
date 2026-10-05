import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getScenarioById } from '@/config/scenarios';
import { CONSENT_VERSION, REVIEW_RETENTION_DAYS, reviewMessages, reviewSharingConfigured, ShareConversationSchema } from '@/lib/research-sharing';
import { deleteReviewShareByHash, insertReviewShare } from '@/lib/research-storage';

export const dynamic = 'force-dynamic';

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

export async function POST(request: NextRequest) {
  if (!reviewSharingConfigured()) return NextResponse.json({ error: 'Conversation sharing is not available yet' }, { status: 503 });
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const parsed = ShareConversationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid sharing request' }, { status: 400 });
  const scenario = getScenarioById(parsed.data.scenarioId);
  if (!scenario) return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
  const messages = reviewMessages(parsed.data.messages);
  if (messages.length < 2 || !messages.some((message) => message.role === 'user')) {
    return NextResponse.json({ error: 'Conversation is too short to share' }, { status: 400 });
  }

  const receipt = randomBytes(32).toString('base64url');
  const deleteTokenHash = createHash('sha256').update(receipt).digest('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REVIEW_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  try {
    await insertReviewShare({
      id: randomUUID(),
      delete_token_hash: deleteTokenHash,
      consent_version: CONSENT_VERSION,
      consented_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      adult_confirmed: true,
      scenario_id: scenario.id,
      language: scenario.language,
      proficiency_level: parsed.data.proficiencyLevel,
      messages,
    });
    return NextResponse.json({ receipt, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    console.error('Review share failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Could not share conversation. Nothing was saved for review.' }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!reviewSharingConfigured()) return NextResponse.json({ error: 'Conversation deletion is unavailable' }, { status: 503 });
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const parsed = z.object({ receipt: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid receipt' }, { status: 400 });
  const hash = createHash('sha256').update(parsed.data.receipt).digest('hex');
  try {
    await deleteReviewShareByHash(hash);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Review deletion failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Could not delete the shared conversation' }, { status: 502 });
  }
}
