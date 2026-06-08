import { NextRequest, NextResponse } from 'next/server';
import { v2, protos } from '@google-cloud/speech';

type SpeechResult = protos.google.cloud.speech.v2.SpeechRecognitionResult;

const REGION = 'us';
const MODAL_BASE_URL = process.env.HAUSA_MODAL_STT_URL;

// Initialize Google Cloud Speech-to-Text v2 Client
const speechClient = new v2.SpeechClient({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  apiEndpoint: `${REGION}-speech.googleapis.com`,
});

/**
 * GET Handler: Handles safe client-side polling for asynchronous tasks
 * without blocking long-running server connections.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const callId = searchParams.get('callId');

    if (!callId) {
      return NextResponse.json({ error: 'Missing callId parameter' }, { status: 400 });
    }

    if (!MODAL_BASE_URL) {
      return NextResponse.json({ error: 'Modal Hausa URL not configured' }, { status: 500 });
    }

    const pollResponse = await fetch(`${MODAL_BASE_URL}/result/${callId}`, {
      method: 'GET',
      cache: 'no-store', // Bypass Next.js cache mechanisms
    });

    if (!pollResponse.ok) {
      throw new Error(`Modal result lookup failed with status ${pollResponse.status}`);
    }

    const resultData = await pollResponse.json();
    return NextResponse.json(resultData);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Transcription API Polling Route Error:', errorMsg);
    return NextResponse.json(
      { error: 'Failed to verify background task status', details: errorMsg },
      { status: 500 }
    );
  }
}

/**
 * POST Handler: Processes incoming audio payloads
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as Blob | null;
    
    // Read the language parameter passed from the UI (defaults to yoruba)
    const language = (formData.get('language') as string || 'yoruba').toLowerCase();

    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
    }

    // Convert blob to raw buffer for stream transmission
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioContent = Buffer.from(arrayBuffer);

    // ==========================================
    // PATH A: HAUSA PIPELINE (Modal Async Polling)
    // ==========================================
    if (language === 'hausa') {
      if (!MODAL_BASE_URL) {
        return NextResponse.json({ error: 'Modal Hausa URL not configured' }, { status: 500 });
      }

      console.log('[STT Router] Dispatched Hausa audio to Modal queue...');

      // Submit the audio buffer directly to Modal using its true recording content-type
      const submitResponse = await fetch(`${MODAL_BASE_URL}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': audioFile.type || 'audio/webm' },
        body: audioContent,
      });

      if (!submitResponse.ok) {
        throw new Error(`Modal submission failed with status ${submitResponse.status}`);
      }

      const { call_id } = await submitResponse.json();
      console.log(`[STT Router] Hausa Job queued. ID: ${call_id}`);

      // Instantly hand off control back to client before server constraints kick in
      return NextResponse.json({ status: 'queued', callId: call_id }, { status: 202 });
    }

    // ==========================================
    // PATH B: YORUBA PIPELINE (Google Cloud STT)
    // ==========================================
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) {
      return NextResponse.json({ error: 'Google Cloud project ID not configured' }, { status: 500 });
    }

    console.log('[STT Router] Processing Yoruba audio via Google Cloud Chirp...');
    
    const response = await speechClient.recognize({
      recognizer: `projects/${projectId}/locations/${REGION}/recognizers/_`,
      config: {
        autoDecodingConfig: {},
        model: 'chirp_3', // Google Cloud Chirp model
        languageCodes: ['yo-NG'], // Target Yoruba language
      },
      content: audioContent,
    });

    const transcript = (response[0]?.results as Array<SpeechResult>)
      ?.map((result) => result.alternatives?.[0]?.transcript || '')
      .join(' ')
      .trim() || '';

    if (!transcript) {
      return NextResponse.json({ error: 'Could not transcribe Yoruba audio' }, { status: 400 });
    }

    return NextResponse.json({ transcription: transcript });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Transcription API Routing Error:', errorMsg);
    return NextResponse.json(
      { error: 'Failed to transcribe audio', details: errorMsg },
      { status: 500 }
    );
  }
}