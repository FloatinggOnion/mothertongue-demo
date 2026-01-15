import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'; // High performance model for audio

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as Blob;

    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
    }

    // Convert blob to base64
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    const result = await genAI.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: 'Transcribe this audio exactly as spoken. If there are Yoruba words, transcribe them correctly. Only output the transcription, no valid preamble.',
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
      config: {
        temperature: 0.0,
        maxOutputTokens: 500,
      },
    });

    const transcription = result.text || '';
    
    return NextResponse.json({ transcription });
  } catch (error) {
    console.error('Transcription API error:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
}
