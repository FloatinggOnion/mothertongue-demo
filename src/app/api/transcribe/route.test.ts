import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';
import { POST } from './route';

const originalFetch = global.fetch;

function makeRequest(fields: Record<string, string | Blob>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.append(key, value);
  return { formData: async () => formData } as unknown as NextRequest;
}

describe('POST /api/transcribe', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
    process.env.INTRON_API_KEY = 'test-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it.each([
    ['yoruba', 'yo', 'Ẹ kú àárọ̀'],
    ['hausa', 'ha', 'Sannu'],
    ['igbo', 'ig', 'Nnọọ'],
  ])('transcribes %s audio using Intron code %s', async (language, code, transcription) => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { audio_transcript: transcription } }),
    });

    const response = await POST(makeRequest({ audio: new Blob(['audio'], { type: 'audio/webm' }), language }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ transcription });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://infer.voice.intron.io/file/v1/upload/sync',
      expect.objectContaining({ method: 'POST', headers: { Authorization: 'Bearer test-key' } })
    );
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get('use_language_asr_input')).toBe(code);
    expect(body.get('audio_file_blob')).toBeInstanceOf(Blob);
  });

  it('defaults to Yoruba when language is omitted', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { audio_transcript: 'Báwo ni' } }) });
    await POST(makeRequest({ audio: new Blob(['audio']) }));
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get('use_language_asr_input')).toBe('yo');
  });

  it('rejects an unsupported language before calling Intron', async () => {
    const response = await POST(makeRequest({ audio: new Blob(['audio']), language: 'french' }));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects missing audio', async () => {
    expect((await POST(makeRequest({ language: 'yoruba' }))).status).toBe(400);
  });

  it('returns 400 for an empty transcript', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { audio_transcript: '  ' } }) });
    expect((await POST(makeRequest({ audio: new Blob(['audio']) }))).status).toBe(400);
  });

  it('returns 500 when Intron fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'unavailable' });
    expect((await POST(makeRequest({ audio: new Blob(['audio']) }))).status).toBe(500);
  });
});
