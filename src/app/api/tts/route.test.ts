import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';

const { synthesizeSpeechMock } = vi.hoisted(() => ({ synthesizeSpeechMock: vi.fn() }));

vi.mock('@google-cloud/text-to-speech', () => ({
  TextToSpeechClient: class {
    synthesizeSpeech = synthesizeSpeechMock;
  },
}));

import { POST } from './route';

const originalFetch = global.fetch;

function makeRequest(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

describe('POST /api/tts', () => {
  beforeEach(() => {
    synthesizeSpeechMock.mockReset();
    global.fetch = vi.fn() as any;
    process.env.INTRON_API_KEY = 'test-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('synthesizes Yoruba speech via Google TTS with gender-mapped ssmlGender', async () => {
    synthesizeSpeechMock.mockResolvedValueOnce([
      { audioContent: Buffer.from('fake-audio') },
    ]);

    const request = makeRequest({ text: 'Ẹ kú àárọ̀', gender: 'female', language: 'yoruba' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(synthesizeSpeechMock).toHaveBeenCalledWith(
      expect.objectContaining({
        voice: expect.objectContaining({ languageCode: 'yo-NG', ssmlGender: 'FEMALE' }),
      })
    );
  });

  it('defaults to male voice when gender is omitted for Yoruba', async () => {
    synthesizeSpeechMock.mockResolvedValueOnce([
      { audioContent: Buffer.from('fake-audio') },
    ]);

    const request = makeRequest({ text: 'hello', language: 'yoruba' });
    await POST(request);

    expect(synthesizeSpeechMock).toHaveBeenCalledWith(
      expect.objectContaining({
        voice: expect.objectContaining({ ssmlGender: 'MALE' }),
      })
    );
  });

  it('synthesizes Hausa speech via Intron, passing gender straight through', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { audio_path: 'https://audio.intron.io/generated/abc.wav' },
          status: 'Ok',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      });

    const request = makeRequest({ text: 'Sannu', gender: 'female', language: 'hausa' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://infer.voice.intron.io/tts/v1/generate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      })
    );
    const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(callBody).toEqual({
      text: 'Sannu',
      voice_language: 'hausa',
      voice_accent: 'hausa',
      voice_gender: 'female',
      output_audio_format: 'wav',
    });
    expect(global.fetch).toHaveBeenNthCalledWith(2, 'https://audio.intron.io/generated/abc.wav');
  });

  it('returns 500 when Intron is not configured', async () => {
    delete process.env.INTRON_API_KEY;

    const request = makeRequest({ text: 'Sannu', language: 'hausa' });
    const response = await POST(request);

    expect(response.status).toBe(500);
  });

  it('returns 500 when the Intron generate call fails', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'error details',
    });

    const request = makeRequest({ text: 'Sannu', language: 'hausa' });
    const response = await POST(request);

    expect(response.status).toBe(500);
  });

  it('returns 500 when the Intron response is missing audio_path', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: {}, status: 'Ok' }),
    });

    const request = makeRequest({ text: 'Sannu', language: 'hausa' });
    const response = await POST(request);

    expect(response.status).toBe(500);
  });

  it('returns 500 when fetching the generated audio_path fails', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { audio_path: 'https://audio.intron.io/generated/abc.wav' } }),
      })
      .mockResolvedValueOnce({ ok: false, status: 404 });

    const request = makeRequest({ text: 'Sannu', language: 'hausa' });
    const response = await POST(request);

    expect(response.status).toBe(500);
  });

  it('rejects an empty text body', async () => {
    const request = makeRequest({ text: '', language: 'yoruba' });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
