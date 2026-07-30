import { NextRequest, NextResponse } from 'next/server';
import { getPartnerResponse, classifyUserTurn, getAsideAnswer } from '@/services/groq';
import { getScenarioById } from '@/config/scenarios';
import { ChatSchema, getZodErrorMessage } from '@/lib/zod-schemas';
import { roleplayHistory } from '@/lib/conversation';

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
      forceAside,
    } = validationResult.data;

    const scenario = getScenarioById(scenarioId);
    if (!scenario) {
      return NextResponse.json(
        { error: 'Scenario not found' },
        { status: 404 }
      );
    }

    // 🌟 Safely attach the language onto the scenario object
    // This passes the data forward without using a 5th argument slot
    const fallbackData = validationResult.data as Record<string, any>;
    const dynamicScenario = {
      ...scenario,
      language: fallbackData.language || 'yoruba'
    };

    // Defensive strip: the client already filters asides out of the history
    // it sends, but the route is the trust boundary that guarantees the
    // partner model never sees an aside — belt and braces.
    const safeHistory = roleplayHistory(conversationHistory);

    // Honour an explicit manual override (Ask button) by skipping
    // classification entirely; otherwise classify the turn.
    const turnKind = forceAside ? 'aside' : await classifyUserTurn(userMessage, dynamicScenario.language);

    if (turnKind === 'aside') {
      const { answer } = await getAsideAnswer(userMessage, dynamicScenario, proficiencyLevel, dynamicScenario.language);
      return NextResponse.json({ kind: 'aside', answer });
    }

    // Get AI partner response using 4 parameters
    const response = await getPartnerResponse(
      dynamicScenario,
      proficiencyLevel,
      safeHistory,
      userMessage
    );

    return NextResponse.json({ kind: 'roleplay', ...response });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}