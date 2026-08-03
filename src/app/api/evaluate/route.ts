import { NextRequest, NextResponse } from 'next/server';
import { evaluateConversation } from '@/services/llm';
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
      language,
      proficiencyLevel,
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

    // Minimum-content guardrail: a single user turn doesn't have enough signal
    // for a reliable score — surface a friendly 400 instead of a confident but
    // meaningless number.
    const userTurns = messages.filter((m) => m.role === 'user');
    if (userTurns.length < 2) {
      return NextResponse.json(
        { error: 'Not enough conversation yet to evaluate — keep chatting a bit longer.' },
        { status: 400 }
      );
    }

    const evaluation = await evaluateConversation(scenario, messages, language, proficiencyLevel);

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
