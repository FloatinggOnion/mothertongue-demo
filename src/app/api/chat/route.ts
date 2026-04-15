import { NextRequest, NextResponse } from 'next/server';
import {
  getPartnerResponse,
  getReplySuggestions,
} from '@/services/gemini';
import { getScenarioById } from '@/config/scenarios';
import { ChatSchema, getZodErrorMessage } from '@/lib/zod-schemas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body with Zod
    const validationResult = ChatSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: getZodErrorMessage(validationResult.error) },
        { status: 400 }
      );
    }

    const {
      scenarioId,
      proficiencyLevel,
      conversationHistory,
      userMessage,
    } = validationResult.data;

    const scenario = getScenarioById(scenarioId);
    if (!scenario) {
      return NextResponse.json(
        { error: 'Scenario not found' },
        { status: 404 }
      );
    }

    // Get AI partner response
    const response = await getPartnerResponse(
      scenario,
      proficiencyLevel,
      conversationHistory,
      userMessage
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}
