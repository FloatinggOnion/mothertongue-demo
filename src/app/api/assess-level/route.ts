import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AssessLevelSchema, getZodErrorMessage } from '@/lib/zod-schemas';
import { assessProficiency } from '@/services/gemini';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { proficiencyLevel, conversationHistory } = AssessLevelSchema.parse(body);
    const assessment = await assessProficiency(conversationHistory, proficiencyLevel);
    return NextResponse.json(assessment);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: getZodErrorMessage(error) }, { status: 400 });
    }
    return NextResponse.json({ error: 'Assessment failed' }, { status: 500 });
  }
}
