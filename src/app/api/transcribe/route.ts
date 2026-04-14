import { NextRequest, NextResponse } from 'next/server';
import { SpeechClient } from '@google-cloud/speech';

// Initialize Speech-to-Text v2 client with credentials
const speechClient = new SpeechClient({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as Blob | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'audio is required' }, { status: 400 });
    }

    // Convert blob to base64
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    // Get Google Cloud project ID from environment
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    if (!projectId) {
      return NextResponse.json(
        { error: 'Google Cloud project ID not configured' },
        { status: 500 }
      );
    }

    // Speech-to-Text v2 API request
    const response = await speechClient.recognize({
      recognizer: `projects/${projectId}/locations/global/recognizers/_`,
      config: {
        autoDecoding: {},
        model: 'chirp_3',
        languageCodes: ['yo-NG', 'en-NG'],
      },
      audio: {
        content: base64Audio,
      },
    });

    // Extract transcript from response
    const transcript = response[0]?.results
      ?.map((result: any) => result.alternatives?.[0]?.transcript || '')
      .join(' ')
      .trim() || '';

    if (!transcript) {
      return NextResponse.json(
        { error: 'Could not transcribe audio' },
        { status: 400 }
      );
    }

    return NextResponse.json({ transcription: transcript });
  } catch (error) {
    console.error('Transcription API error:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
}
