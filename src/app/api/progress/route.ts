import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getScenarioById } from '@/config/scenarios';
import { mergeUserProgress, readUserProgress, SaveProgressSchema } from '@/lib/progress';

export const dynamic = 'force-dynamic';

function accountsConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

async function signedInUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

export async function GET() {
  if (!accountsConfigured()) {
    return NextResponse.json({ error: 'Account saving is not configured' }, { status: 503 });
  }
  const userId = await signedInUserId();
  if (!userId) return NextResponse.json({ error: 'Sign in to see your progress' }, { status: 401 });

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return NextResponse.json(readUserProgress(user.privateMetadata?.mtProgress));
  } catch (error) {
    console.error('Progress read failed:', error);
    return NextResponse.json({ error: 'Could not load progress' }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  if (!accountsConfigured()) {
    return NextResponse.json({ error: 'Account saving is not configured' }, { status: 503 });
  }
  const userId = await signedInUserId();
  if (!userId) return NextResponse.json({ error: 'Sign in to save progress' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = SaveProgressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid progress data' }, { status: 400 });
  }
  const scenario = getScenarioById(parsed.data.scenarioId);
  if (!scenario) return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const progress = mergeUserProgress(user.privateMetadata?.mtProgress, parsed.data, scenario);
    if (new TextEncoder().encode(JSON.stringify(progress)).length > 7000) {
      return NextResponse.json({ error: 'Progress storage is full' }, { status: 413 });
    }
    await client.users.replaceUserMetadata(userId, {
      privateMetadata: { ...user.privateMetadata, mtProgress: progress },
    });
    return NextResponse.json(progress);
  } catch (error) {
    console.error('Progress save failed:', error);
    return NextResponse.json({ error: 'Could not save progress. Your practice remains on this device.' }, { status: 502 });
  }
}
