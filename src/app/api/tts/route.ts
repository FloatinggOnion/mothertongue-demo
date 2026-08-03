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
    // PATH A: HAUSA PIPELINE (Intron)
    // ==========================================
    if (language?.toLowerCase() === 'hausa') {
      const apiKey = process.env.INTRON_API_KEY;

      if (!apiKey) {
        return NextResponse.json({ error: 'Intron Hausa TTS not configured' }, { status: 500 });
      }

      console.log('[TTS Router] Dispatched Hausa TTS to Intron...');

      const generateResponse = await fetch('https://infer.voice.intron.io/tts/v1/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice_language: 'hausa',
          voice_accent: 'hausa',
          voice_gender: voiceGender,
          output_audio_format: 'wav',
        }),
      });

      if (!generateResponse.ok) {
        const details = await generateResponse.text();
        console.error('[TTS Router] Intron Hausa TTS failed:', generateResponse.status, details);
        return NextResponse.json({ error: 'Failed to generate Hausa speech' }, { status: 500 });
      }

      const generateData = await generateResponse.json();
      const audioPath = generateData?.data?.audio_path;

      if (!audioPath) {
        console.error('[TTS Router] Intron response missing audio_path:', generateData);
        return NextResponse.json({ error: 'Failed to generate Hausa speech' }, { status: 500 });
      }

      const audioResponse = await fetch(audioPath);
      if (!audioResponse.ok) {
        console.error('[TTS Router] Failed to fetch Intron audio_path:', audioResponse.status);
        return NextResponse.json({ error: 'Failed to fetch generated Hausa speech' }, { status: 500 });
      }

      const audioBuffer = await audioResponse.arrayBuffer();
      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/wav',
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
