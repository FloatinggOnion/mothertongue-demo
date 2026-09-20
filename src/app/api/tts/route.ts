import { NextRequest, NextResponse } from 'next/server';
import { TtsSchema, getZodErrorMessage } from '@/lib/zod-schemas';

const INTRON_TTS: Record<string, { voice_language: string; voice_accent: string }> = {
  hausa:  { voice_language: 'ha', voice_accent: 'hausa' },
  igbo:   { voice_language: 'ig', voice_accent: 'igbo' },
  yoruba: { voice_language: 'yo', voice_accent: 'yoruba' },
};

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
    const voiceGender = gender ?? 'female';
    const lang = (language || 'yoruba').toLowerCase();
    const config = INTRON_TTS[lang];

    if (!config) {
      return NextResponse.json({ error: `Unsupported language: ${lang}` }, { status: 400 });
    }

    const apiKey = process.env.INTRON_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Intron API key not configured' }, { status: 500 });
    }

    console.log(`[TTS] ${lang} → Intron (${config.voice_language})`);

    const generateResponse = await fetch('https://infer.voice.intron.io/tts/v1/generate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        ...config,
        voice_gender: voiceGender,
        output_audio_format: 'wav',
      }),
    });

    if (!generateResponse.ok) {
      const details = await generateResponse.text();
      console.error(`[TTS] Intron ${lang} failed:`, generateResponse.status, details);
      return NextResponse.json({ error: `Failed to generate ${lang} speech` }, { status: 500 });
    }

    const generateData = await generateResponse.json();
    const audioPath: unknown = generateData?.data?.audio_path;

    if (typeof audioPath !== 'string' || !audioPath.startsWith('https://')) {
      console.error('[TTS] Intron response missing or invalid audio_path:', generateData);
      return NextResponse.json({ error: 'Failed to generate speech' }, { status: 500 });
    }

    const audioResponse = await fetch(audioPath);
    if (!audioResponse.ok) {
      console.error('[TTS] Failed to fetch Intron audio_path:', audioResponse.status);
      return NextResponse.json({ error: 'Failed to fetch generated speech' }, { status: 500 });
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: { 'Content-Type': 'audio/wav' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[TTS] API error:', msg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
