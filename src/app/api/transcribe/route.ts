import { NextRequest, NextResponse } from 'next/server';
import { callGemini } from '@/services/gemini';

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

    const transcription = await callGemini({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: 'Transcribe this audio exactly as spoken. If there are Yoruba words, transcribe them correctly. Only output the transcription, no extra preamble.',
            },
            {
              inlineData: {
                mimeType: audioFile.type || 'audio/webm',
                data: base64Audio,
              },
            },
          ],
        },
      ],
      temperature: 0.0,
      maxOutputTokens: 500,
    });

    return NextResponse.json({ transcription });
  } catch (error) {
    console.error('Transcription API error:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
}
