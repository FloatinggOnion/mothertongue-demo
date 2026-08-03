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
    process.env.ELEVENLABS_API_KEY = 'test-key';
    process.env.ELEVENLABS_VOICE_ID = 'voice-fixed';
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

  it('synthesizes Hausa speech via ElevenLabs using the configured voice id', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    });

    const request = makeRequest({ text: 'Sannu', gender: 'female', language: 'hausa' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.elevenlabs.io/v1/text-to-speech/voice-fixed',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'xi-api-key': 'test-key' }),
      })
    );
    const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(callBody).toEqual({
      text: 'Sannu',
      model_id: 'eleven_v3',
      language_code: 'hau',
    });
  });

  it('uses the same voice id for Hausa regardless of gender', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    });

    await POST(makeRequest({ text: 'Sannu', gender: 'male', language: 'hausa' }));
    await POST(makeRequest({ text: 'Sannu', gender: 'female', language: 'hausa' }));

    const urls = (global.fetch as any).mock.calls.map((call: unknown[]) => call[0]);
    expect(urls).toEqual([
      'https://api.elevenlabs.io/v1/text-to-speech/voice-fixed',
      'https://api.elevenlabs.io/v1/text-to-speech/voice-fixed',
    ]);
  });

  it('returns 500 when ElevenLabs is not configured', async () => {
    delete process.env.ELEVENLABS_API_KEY;

    const request = makeRequest({ text: 'Sannu', language: 'hausa' });
    const response = await POST(request);

    expect(response.status).toBe(500);
  });

  it('returns 500 when ElevenLabs request fails', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'error details',
    });

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
