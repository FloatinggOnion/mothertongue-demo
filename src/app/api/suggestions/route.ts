import { NextRequest, NextResponse } from 'next/server';
import { getReplySuggestions } from '@/services/gemini';
import { getScenarioById } from '@/config/scenarios';
import { SuggestionsSchema, getZodErrorMessage } from '@/lib/zod-schemas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

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

    const suggestions = await getReplySuggestions(
      scenario,
      proficiencyLevel,
      conversationHistory,
      lastAiMessage
    );

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Suggestions API error:', error);
    return NextResponse.json(
      { error: 'Failed to get suggestions' },
      { status: 500 }
    );
  }
}
