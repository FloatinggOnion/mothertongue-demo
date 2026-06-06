import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { TtsSchema, getZodErrorMessage } from '@/lib/zod-schemas';

// Yoruba (Nigeria) TTS - let Google Cloud pick the default voice for yo-NG locale

// Initialize client with credentials from environment variables
const client = new TextToSpeechClient({
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
    console.log('[TTS] Request:', { textLength: text.length, gender, language });

    // ==========================================
    // PATH A: HAUSA PIPELINE (Modal Engine)
    // ==========================================
    if (language?.toLowerCase() === 'hausa') {
      const modalUrl = process.env.HAUSA_MODAL_TTS_URL;
      if (!modalUrl) {
        return NextResponse.json({ error: 'Hausa TTS URL not configured' }, { status: 500 });
      }

      console.log('[TTS Router] Dispatched Hausa TTS to Modal...');
      
      const modalResponse = await fetch(modalUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!modalResponse.ok) {
        console.error('[TTS Router] Hausa TTS failed:', modalResponse.statusText);
        return NextResponse.json({ error: 'Failed to generate Hausa speech' }, { status: 500 });
      }

      const audioBuffer = await modalResponse.arrayBuffer();
      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/wav',
        },
      });
    }

    // ==========================================
    // PATH B: YORUBA PIPELINE (Google Cloud TTS)
    // ==========================================
    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode: 'yo-NG'
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

    // Return audio as MP3
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
    console.error('[TTS] Google TTS API error:', msg);

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

