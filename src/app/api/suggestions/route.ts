import { NextRequest, NextResponse } from 'next/server';
import { getReplySuggestions } from '@/services/gemini';
import { getScenarioById } from '@/config/scenarios';
import { SuggestionsSchema, getZodErrorMessage } from '@/lib/zod-schemas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body with Zod
    const validationResult = SuggestionsSchema.safeParse(body);
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
      lastAiMessage,
    } = validationResult.data;

    const scenario = getScenarioById(scenarioId);
    if (!scenario) {
      return NextResponse.json(
        { error: 'Scenario not found' },
        { status: 404 }
      );
    }

    // Safely inject the language onto the scenario context to pass it seamlessly
    const fallbackData = validationResult.data as Record<string, any>;
    const dynamicScenario = {
      ...scenario,
      language: fallbackData.language || 'yoruba'
    };

    // Get dynamic speech variations from Gemini based on the selected language
    const response = await getReplySuggestions(
      dynamicScenario,
      proficiencyLevel,
      conversationHistory,
      lastAiMessage
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error('Suggestions API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}