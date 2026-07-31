import { NextRequest, NextResponse } from 'next/server';
import { v2, protos } from '@google-cloud/speech';

type SpeechResult = protos.google.cloud.speech.v2.SpeechRecognitionResult;

const REGION = 'us';

const LANGUAGE_CODES: Record<string, string> = {
  yoruba: 'yo-NG',
  hausa: 'ha-NG',
};

// Initialize Google Cloud Speech-to-Text v2 Client
const speechClient = new v2.SpeechClient({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  apiEndpoint: `${REGION}-speech.googleapis.com`,
});

/**
 * POST Handler: Transcribes audio via Google Cloud Chirp for Yoruba (yo-NG) or Hausa (ha-NG)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as Blob | null;

    const language = (formData.get('language') as string || 'yoruba').toLowerCase();
    const languageCode = LANGUAGE_CODES[language];

    if (!languageCode) {
      return NextResponse.json({ error: `Unsupported language: ${language}` }, { status: 400 });
    }

    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const audioContent = Buffer.from(arrayBuffer);

    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) {
      return NextResponse.json({ error: 'Google Cloud project ID not configured' }, { status: 500 });
    }

    console.log(`[STT] Transcribing ${language} audio via Google Cloud Chirp (${languageCode})...`);

    const response = await speechClient.recognize({
      recognizer: `projects/${projectId}/locations/${REGION}/recognizers/_`,
      config: {
        autoDecodingConfig: {},
        model: 'chirp_3',
        languageCodes: [languageCode],
      },
      content: audioContent,
    });

    const transcript = (response[0]?.results as Array<SpeechResult>)
      ?.map((result) => result.alternatives?.[0]?.transcript || '')
      .join(' ')
      .trim() || '';

    if (!transcript) {
      return NextResponse.json({ error: `Could not transcribe ${language} audio` }, { status: 400 });
    }

    return NextResponse.json({ transcription: transcript });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Transcription API Error:', errorMsg);
    return NextResponse.json(
      { error: 'Failed to transcribe audio', details: errorMsg },
      { status: 500 }
    );
  }
}
