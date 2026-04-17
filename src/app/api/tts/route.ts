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

    const { text, gender } = validationResult.data;

    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode: 'yo-NG',
        name: 'yo-NG-Standard-A', // only available Yoruba voice in Google Cloud TTS
        ssmlGender: 'FEMALE',
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0.0,
      },
    });

    const audioContent = response.audioContent;

    if (!audioContent) {
      console.error('Google TTS returned empty audio content');
      return NextResponse.json(
        { error: 'Failed to generate speech content' },
        { status: 500 }
      );
    }

    // Return audio as MP3
    const audioBytes = typeof audioContent === 'string'
      ? new TextEncoder().encode(audioContent)
      : audioContent;

    return new Response(audioBytes as unknown as BodyInit, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioContent.length.toString(),
      },
    });
  } catch (error: unknown) {
    console.error('Google TTS API error:', error);

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
