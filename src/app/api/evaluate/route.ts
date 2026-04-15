import { NextRequest, NextResponse } from 'next/server';
import { evaluateConversation } from '@/services/gemini';
import { getScenarioById } from '@/config/scenarios';
import { EvaluateSchema, getZodErrorMessage } from '@/lib/zod-schemas';
import { logError } from '@/lib/logger';

export async function POST(request: NextRequest) {
  let scenarioId: string | undefined;
  let messageCount: number | undefined;

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
      scenarioId: validatedScenarioId,
      messages,
    } = validationResult.data;

    scenarioId = validatedScenarioId;
    messageCount = messages.length;

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
    logError('/api/evaluate', error, {
      scenarioId,
      messageCount,
    });
    return NextResponse.json(
      { error: 'Failed to evaluate conversation' },
      { status: 500 }
    );
  }
}
