import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { TtsSchema, getZodErrorMessage } from '@/lib/zod-schemas';

// Initialize Google Cloud TTS client (used for Yoruba)
const googleClient = new TextToSpeechClient({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validationResult = TtsSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: getZodErrorMessage(validationResult.error) },
        { status: 400 }
      );
    }

    const { text, gender, language } = validationResult.data;
    const voiceGender = gender ?? 'male';
    console.log('[TTS] Request:', { textLength: text.length, gender: voiceGender, language });

    // ==========================================
    // PATH A: HAUSA PIPELINE (ElevenLabs)
    // ==========================================
    if (language?.toLowerCase() === 'hausa') {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      const voiceId = process.env.ELEVENLABS_VOICE_ID;

      if (!apiKey || !voiceId) {
        return NextResponse.json({ error: 'ElevenLabs Hausa TTS not configured' }, { status: 500 });
      }

      console.log('[TTS Router] Dispatched Hausa TTS to ElevenLabs...');

      const elevenLabsResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_v3',
            language_code: 'hau',
          }),
        }
      );

      if (!elevenLabsResponse.ok) {
        const details = await elevenLabsResponse.text();
        console.error('[TTS Router] ElevenLabs Hausa TTS failed:', elevenLabsResponse.status, details);
        return NextResponse.json({ error: 'Failed to generate Hausa speech' }, { status: 500 });
      }

      const audioBuffer = await elevenLabsResponse.arrayBuffer();
      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
        },
      });
    }

    // ==========================================
    // PATH B: YORUBA PIPELINE (Google Cloud TTS)
    // ==========================================
    const [response] = await googleClient.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode: 'yo-NG',
        ssmlGender: voiceGender === 'female' ? 'FEMALE' : 'MALE',
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0.0,
      },
    });

    const audioContent = response.audioContent;

    if (!audioContent) {
      console.error('[TTS] Google TTS returned empty audio content');
      return NextResponse.json(
        { error: 'Failed to generate speech content' },
        { status: 500 }
      );
    }

    console.log('[TTS] Success, audioContent type:', typeof audioContent, 'length:', audioContent.length);

    const audioBytes = typeof audioContent === 'string'
      ? Buffer.from(audioContent, 'base64')
      : audioContent;

    return new Response(audioBytes as unknown as BodyInit, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioContent.length.toString(),
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[TTS] API error:', msg);

    if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string' && (error as { message: string }).message.includes('credentials')) {
      return NextResponse.json(
        { error: 'Google Cloud credentials not configured or invalid' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
