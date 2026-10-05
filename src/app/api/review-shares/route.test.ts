import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { CONSENT_VERSION } from '@/lib/research-sharing';

const { insertMock, deleteMock } = vi.hoisted(() => ({ insertMock: vi.fn(), deleteMock: vi.fn() }));
vi.mock('@/lib/research-storage', () => ({ insertReviewShare: insertMock, deleteReviewShareByHash: deleteMock }));

import { POST, DELETE } from './route';

function request(body: unknown) {
  return { json: async () => body, headers: new Headers({ origin: 'https://trymothertongue.com' }), url: 'https://trymothertongue.com/api/review-shares' } as unknown as NextRequest;
}

describe('/api/review-shares', () => {
  beforeEach(() => {
    vi.stubEnv('NEON_DATABASE_URL', 'postgresql://test:test@example.neon.tech/test');
    vi.stubEnv('CRON_SECRET', 'test-cron-secret');
    vi.stubEnv('NEXT_PUBLIC_RESEARCH_SHARING_ENABLED', 'true');
    insertMock.mockReset();
    deleteMock.mockReset();
    insertMock.mockResolvedValue(undefined);
    deleteMock.mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  const body = { scenarioId: 'market-haggling', proficiencyLevel: 'beginner', adultConfirmed: true, consented: true, consentVersion: CONSENT_VERSION, messages: [{ role: 'ai', content: 'Ẹ káàárọ̀' }, { role: 'user', content: 'I want tomatoes' }] };

  it('does not save text without adult confirmation and explicit consent', async () => {
    expect((await POST(request({ ...body, adultConfirmed: false }))).status).toBe(400);
    expect((await POST(request({ ...body, consented: false }))).status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('saves only canonical scenario language with expiry before daily 30-day cleanup and returns a deletion receipt', async () => {
    const response = await POST(request({ ...body, language: 'hausa' }));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.receipt).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const row = insertMock.mock.calls[0][0];
    expect(row.language).toBe('yoruba');
    expect(new Date(row.expires_at).getTime() - new Date(row.consented_at).getTime()).toBe(29 * 24 * 60 * 60 * 1000);
    expect(row).not.toHaveProperty('email');
  });

  it('does not accept shares unless deletion is configured', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect((await POST(request(body))).status).toBe(503);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('deletes by a hash of the receipt', async () => {
    const receipt = 'a'.repeat(43);
    expect((await DELETE(request({ receipt }))).status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/));
  });
});
