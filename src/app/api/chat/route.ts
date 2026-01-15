import { NextRequest, NextResponse } from 'next/server';
import {
  getPartnerResponse,
  getReplySuggestions,
} from '@/services/gemini';
import { getScenarioById } from '@/config/scenarios';
import { Message, ProficiencyLevel } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      scenarioId,
      proficiencyLevel,
      conversationHistory,
      userMessage,
    }: {
      scenarioId: string;
      proficiencyLevel: ProficiencyLevel;
      conversationHistory: Message[];
      userMessage: string;
    } = body;

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
