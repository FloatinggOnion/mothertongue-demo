import { NextRequest, NextResponse } from 'next/server';
import { evaluateConversation } from '@/services/gemini';
import { getScenarioById } from '@/config/scenarios';
import { EvaluateSchema, getZodErrorMessage } from '@/lib/zod-schemas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body with Zod
    const validationResult = EvaluateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: getZodErrorMessage(validationResult.error) },
        { status: 400 }
      );
    }

    const {
      scenarioId,
      messages,
    } = validationResult.data;

    const scenario = getScenarioById(scenarioId);
    if (!scenario) {
      return NextResponse.json(
        { error: 'Scenario not found' },
        { status: 404 }
      );
    }

    const evaluation = await evaluateConversation(scenario, messages);

    return NextResponse.json(evaluation);
  } catch (error) {
    console.error('Evaluate API error:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate conversation' },
      { status: 500 }
    );
  }
}
