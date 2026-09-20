import { NextRequest, NextResponse } from 'next/server';

const INTRON_STT_CODES: Record<string, string> = {
  hausa:  'ha',
  igbo:   'ig',
  yoruba: 'yo',
};

function audioExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/ogg':  'ogg',
    'audio/wav':  'wav',
    'audio/mp4':  'mp4',
    'audio/mpeg': 'mp3',
    'audio/flac': 'flac',
  };
  return map[mimeType] || 'webm';
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as Blob | null;
    const language = (formData.get('language') as string || 'yoruba').toLowerCase();

    const langCode = INTRON_STT_CODES[language];
    if (!langCode) {
      return NextResponse.json({ error: `Unsupported language: ${language}` }, { status: 400 });
    }

    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
    }

    const apiKey = process.env.INTRON_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Intron API key not configured' }, { status: 500 });
    }

    console.log(`[STT] Transcribing ${language} audio via Intron (${langCode})...`);

    const intronForm = new FormData();
    intronForm.append('audio_file_name', `audio_${language}`);
    intronForm.append(
      'audio_file_blob',
      audioFile,
      `audio.${audioExtension(audioFile.type)}`
    );
    intronForm.append('use_language_asr_input', langCode);

    const response = await fetch('https://infer.voice.intron.io/file/v1/upload/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: intronForm,
    });

    if (!response.ok) {
      const details = await response.text();
      console.error('[STT] Intron error:', response.status, details);
      return NextResponse.json({ error: `Failed to transcribe ${language} audio` }, { status: 500 });
    }

    const data = await response.json();
    const transcript = data?.data?.audio_transcript?.trim();

    if (!transcript) {
      return NextResponse.json({ error: `Could not transcribe ${language} audio` }, { status: 400 });
    }

    return NextResponse.json({ transcription: transcript });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[STT] Error:', errorMsg);
    return NextResponse.json(
      { error: 'Failed to transcribe audio', details: errorMsg },
      { status: 500 }
    );
  }
}
