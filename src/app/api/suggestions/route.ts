import { NextRequest, NextResponse } from 'next/server';
import { getReplySuggestions } from '@/services/gemini';
import { getScenarioById } from '@/config/scenarios';
import { Message, ProficiencyLevel } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      scenarioId,
      proficiencyLevel,
      conversationHistory,
      lastAiMessage,
    }: {
      scenarioId: string;
      proficiencyLevel: ProficiencyLevel;
      conversationHistory: Message[];
      lastAiMessage: string;
    } = body;

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
