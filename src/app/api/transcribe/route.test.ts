import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const { recognizeMock } = vi.hoisted(() => ({ recognizeMock: vi.fn() }));

vi.mock('@google-cloud/speech', () => ({
  v2: {
    SpeechClient: class {
      recognize = recognizeMock;
    },
  },
  protos: {},
}));

import { POST } from './route';

function makeRequest(fields: Record<string, string | Blob>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return { formData: async () => formData } as unknown as NextRequest;
}

describe('POST /api/transcribe', () => {
  beforeEach(() => {
    recognizeMock.mockReset();
    process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
  });

  it('transcribes Yoruba audio using yo-NG', async () => {
    recognizeMock.mockResolvedValueOnce([
      { results: [{ alternatives: [{ transcript: 'Ẹ kú àárọ̀' }] }] },
    ]);

    const request = makeRequest({
      audio: new Blob(['fake-audio']),
      language: 'yoruba',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.transcription).toBe('Ẹ kú àárọ̀');
    expect(recognizeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ languageCodes: ['yo-NG'] }),
      })
    );
  });

  it('transcribes Hausa audio using ha-NG', async () => {
    recognizeMock.mockResolvedValueOnce([
      { results: [{ alternatives: [{ transcript: 'Sannu' }] }] },
    ]);

    const request = makeRequest({
      audio: new Blob(['fake-audio']),
      language: 'hausa',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.transcription).toBe('Sannu');
    expect(recognizeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ languageCodes: ['ha-NG'] }),
      })
    );
  });

  it('defaults to Yoruba when no language is provided', async () => {
    recognizeMock.mockResolvedValueOnce([
      { results: [{ alternatives: [{ transcript: 'hello' }] }] },
    ]);

    const request = makeRequest({ audio: new Blob(['fake-audio']) });
    await POST(request);

    expect(recognizeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ languageCodes: ['yo-NG'] }),
      })
    );
  });

  it('rejects an unsupported language', async () => {
    const request = makeRequest({
      audio: new Blob(['fake-audio']),
      language: 'igbo',
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('rejects when no audio file is present', async () => {
    const request = makeRequest({ language: 'yoruba' });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 when Google returns an empty transcript', async () => {
    recognizeMock.mockResolvedValueOnce([{ results: [] }]);

    const request = makeRequest({
      audio: new Blob(['fake-audio']),
      language: 'yoruba',
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 500 when Google Cloud call throws', async () => {
    recognizeMock.mockRejectedValueOnce(new Error('boom'));

    const request = makeRequest({
      audio: new Blob(['fake-audio']),
      language: 'yoruba',
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
