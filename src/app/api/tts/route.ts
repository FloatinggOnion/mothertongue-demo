import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // 1. Capture the new parameters sent from your useSpeech hook
    const { text, gender, voiceId } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const modalUrl = process.env.MODAL_TTS_URL;
    if (!modalUrl) {
      console.error('MODAL_TTS_URL is not set');
      return NextResponse.json(
        { error: 'TTS service not configured' },
        { status: 503 }
      );
    }

    const endpoint = modalUrl.endsWith('/generate') 
      ? modalUrl 
      : `${modalUrl.replace(/\/$/, '')}/generate`;

    // 2. Pass gender and voiceId to your Modal deployment
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        text,
        gender: gender || 'male', // Ensure a fallback
        voiceId: voiceId || 'yo-NG' 
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Modal TTS API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to generate speech' },
        { status: response.status }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('TTS API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}