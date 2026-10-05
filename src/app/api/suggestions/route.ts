import { NextRequest, NextResponse } from 'next/server';
import { getReplySuggestions } from '@/services/llm';
import { getScenarioById } from '@/config/scenarios';
import { SuggestionsSchema, getZodErrorMessage } from '@/lib/zod-schemas';
import { z } from 'zod';

const SuggestionsResponseSchema = z.object({
  suggestions: z.array(z.object({
    text: z.string().trim().min(1),
    translation: z.string().default(''),
    label: z.string().optional(),
  })).min(1),
});

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

    const dynamicScenario = scenario;

    // Validate model output before presenting it as learner guidance.
    const response = await getReplySuggestions(
      dynamicScenario,
      proficiencyLevel,
      conversationHistory,
      lastAiMessage
    );

    const parsedResponse = SuggestionsResponseSchema.safeParse(response);
    if (!parsedResponse.success) {
      return NextResponse.json({ error: 'Guidance is unavailable right now. Please try again.' }, { status: 502 });
    }

    return NextResponse.json(parsedResponse.data);
  } catch (error) {
    console.error('Suggestions API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}
