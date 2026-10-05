import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const { authMock, getUserMock, replaceUserMetadataMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getUserMock: vi.fn(),
  replaceUserMetadataMock: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
  clerkClient: async () => ({ users: { getUser: getUserMock, replaceUserMetadata: replaceUserMetadataMock } }),
}));

import { GET, POST } from './route';

const sessionKey = '8aa4e9fc-04f0-489a-b51b-f7721e4758b7';
function request(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

describe('/api/progress', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_sample');
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_sample');
    authMock.mockReset();
    getUserMock.mockReset();
    replaceUserMetadataMock.mockReset();
    authMock.mockResolvedValue({ userId: 'user_1' });
    getUserMock.mockResolvedValue({ privateMetadata: {} });
    replaceUserMetadataMock.mockResolvedValue({});
  });

  afterEach(() => vi.unstubAllEnvs());

  it('keeps public practice available when Clerk is not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', '');
    vi.stubEnv('CLERK_SECRET_KEY', '');
    expect((await GET()).status).toBe(503);
    expect((await POST(request({}))).status).toBe(503);
    expect(authMock).not.toHaveBeenCalled();
  });

  it('requires an account before reading or writing progress', async () => {
    authMock.mockResolvedValue({ userId: null });
    expect((await GET()).status).toBe(401);
    expect((await POST(request({ scenarioId: 'market-haggling' }))).status).toBe(401);
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it('saves a compact summary under the signed-in user and uses the scenario language', async () => {
    const response = await POST(request({
      scenarioId: 'market-haggling',
      proficiencyLevel: 'beginner',
      turnCount: 3,
      sessionKey,
      language: 'hausa',
      messages: [{ content: 'Private conversation' }],
    }));
    expect(response.status).toBe(200);
    const saved = replaceUserMetadataMock.mock.calls[0][1].privateMetadata.mtProgress;
    expect(saved.scenarios['market-haggling'].language).toBe('yoruba');
    expect(JSON.stringify(saved)).not.toContain('Private conversation');
  });
});
