import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { TtsSchema, getZodErrorMessage } from '@/lib/zod-schemas';

// Map gender to Google Cloud TTS Nigerian voices
const VOICE_MAPPING = {
  male: 'en-NG-Wavenet-B',   // Yomi-style male voice
  female: 'en-NG-Wavenet-A', // Olufunmilola-style female voice
};

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

    // Default to female (en-NG-Wavenet-A) if gender not specified
    const voiceName = (gender === 'male' || gender === 'female')
      ? VOICE_MAPPING[gender]
      : VOICE_MAPPING.female;

    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode: 'yo-NG',
        name: voiceName,
        ssmlGender: gender === 'male' ? 'MALE' : 'FEMALE'
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
    return new NextResponse(new Uint8Array(audioContent as Buffer), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioContent.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Google TTS API error:', error);

    // Check for obvious auth issues
    if (error.message?.includes('credentials')) {
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