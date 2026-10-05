import { NextRequest, NextResponse } from 'next/server';
import { getScenarioById } from '@/config/scenarios';
import { analyticsConfigured, MeasurementEventSchema, measurementProperties } from '@/lib/measurement';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!analyticsConfigured()) return NextResponse.json({ error: 'Measurement is not configured' }, { status: 503 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const parsed = MeasurementEventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid measurement event' }, { status: 400 });
  const scenario = getScenarioById(parsed.data.scenarioId);
  if (!scenario) return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });

  const host = process.env.POSTHOG_HOST;
  if (!host || !/^https:\/\/(us|eu)\.i\.posthog\.com\/?$/.test(host)) {
    return NextResponse.json({ error: 'Measurement host is invalid' }, { status: 503 });
  }
  try {
    const response = await fetch(`${host.replace(/\/$/, '')}/i/v0/e/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.POSTHOG_PROJECT_KEY,
        distinct_id: parsed.data.sessionId,
        event: parsed.data.event,
        properties: measurementProperties(parsed.data, scenario.language),
      }),
      signal: AbortSignal.timeout(1500),
      cache: 'no-store',
    });
    if (!response.ok) return NextResponse.json({ error: 'Measurement service unavailable' }, { status: 502 });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Measurement service unavailable' }, { status: 502 });
  }
}
