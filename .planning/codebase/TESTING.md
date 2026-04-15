# Testing Patterns

**Analysis Date:** 2026-03-20

## Test Framework

**Runner:**
- Not detected - No Jest, Vitest, or similar configured
- No test files found in `src/` directory
- `package.json` has no test script defined

**Assertion Library:**
- Not applicable - testing infrastructure not present

**Run Commands:**
```bash
npm run lint              # Run ESLint linting
npm run dev              # Development server (no test mode)
npm run build            # Build Next.js project
npm run start            # Start production server
```

## Test File Organization

**Current State:**
- No test files exist in the codebase
- No dedicated `/tests`, `/__tests__`, or `*.test.ts` files in `src/`

**Recommended Location (When Tests Are Added):**
- Colocated pattern: `src/components/MicButton.test.tsx` alongside component
- Alternative structure: `src/__tests__/components/MicButton.test.tsx`
- API route tests: `src/app/api/__tests__/chat.test.ts`
- Hook tests: `src/hooks/__tests__/useSpeech.test.ts`

**Recommended Naming:**
- Component tests: `[ComponentName].test.tsx`
- Hook tests: `[HookName].test.ts`
- Utility/service tests: `[FileName].test.ts`
- API tests: `[RouteName].test.ts`

## Test Structure

**When implementing tests, use this pattern:**

### Component Testing Pattern:
```typescript
// src/components/MicButton.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MicButton } from './MicButton';

describe('MicButton', () => {
  it('should render with correct initial state', () => {
    const mockPress = jest.fn();
    const mockRelease = jest.fn();

    render(
      <MicButton
        isListening={false}
        isSpeaking={false}
        isLoading={false}
        onPress={mockPress}
        onRelease={mockRelease}
      />
    );

    expect(screen.getByText('Hold to speak')).toBeInTheDocument();
  });

  it('should display listening state when isListening is true', () => {
    const mockPress = jest.fn();
    const mockRelease = jest.fn();

    render(
      <MicButton
        isListening={true}
        isSpeaking={false}
        isLoading={false}
        onPress={mockPress}
        onRelease={mockRelease}
      />
    );

    expect(screen.getByText('Release to send')).toBeInTheDocument();
  });

  it('should call onPress when button is pressed', () => {
    const mockPress = jest.fn();
    const mockRelease = jest.fn();

    render(
      <MicButton
        isListening={false}
        isSpeaking={false}
        isLoading={false}
        onPress={mockPress}
        onRelease={mockRelease}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.mouseDown(button);

    expect(mockPress).toHaveBeenCalled();
  });
});
```

### Hook Testing Pattern:
```typescript
// src/hooks/useSpeech.test.ts
import { renderHook, act } from '@testing-library/react';
import { useSpeechRecognition } from './useSpeech';

describe('useSpeechRecognition', () => {
  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    expect(result.current.isListening).toBe(false);
    expect(result.current.transcript).toBe('');
    expect(result.current.interimTranscript).toBe('');
    expect(result.current.isSupported).toBeDefined();
  });

  it('should update transcript when speech is recognized', async () => {
    const { result } = renderHook(() => useSpeechRecognition());

    await act(async () => {
      result.current.startListening();
    });

    expect(result.current.isListening).toBe(true);
  });

  it('should reset transcript when resetTranscript is called', async () => {
    const { result } = renderHook(() => useSpeechRecognition());

    await act(async () => {
      result.current.resetTranscript();
    });

    expect(result.current.transcript).toBe('');
    expect(result.current.interimTranscript).toBe('');
  });
});
```

### API Route Testing Pattern:
```typescript
// src/app/api/__tests__/chat.test.ts
import { POST } from '../chat/route';
import { NextRequest } from 'next/server';

describe('POST /api/chat', () => {
  it('should return error when scenario is not found', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        scenarioId: 'invalid-id',
        proficiencyLevel: 'beginner',
        conversationHistory: [],
        userMessage: 'Hello',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Scenario not found');
  });

  it('should return partner response for valid request', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        scenarioId: 'market-haggling',
        proficiencyLevel: 'beginner',
        conversationHistory: [],
        userMessage: 'Hello Mama',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reply).toBeDefined();
    expect(data.translation).toBeDefined();
  });
});
```

### Service Function Testing Pattern:
```typescript
// src/services/gemini.test.ts
import { getPartnerResponse, evaluateConversation } from './gemini';
import { getScenarioById } from '@/config/scenarios';

describe('Gemini Services', () => {
  const mockScenario = getScenarioById('market-haggling');

  describe('getPartnerResponse', () => {
    it('should return response with reply and translation', async () => {
      const result = await getPartnerResponse(
        mockScenario!,
        'beginner',
        [],
        'Ẹ kú aro'
      );

      expect(result.reply).toBeDefined();
      expect(result.translation).toBeDefined();
      expect(typeof result.reply).toBe('string');
      expect(typeof result.translation).toBe('string');
    });

    it('should handle API errors gracefully with fallback', async () => {
      // Mock failed API call
      // Should return fallback response
      const result = await getPartnerResponse(
        mockScenario!,
        'beginner',
        [],
        'Test message'
      );

      expect(result.reply).toBeTruthy();
      expect(result.translation).toBeTruthy();
    });
  });

  describe('evaluateConversation', () => {
    it('should return evaluation object with all required fields', async () => {
      const messages = [
        { id: '1', role: 'user' as const, content: 'Ẹ kú aro', timestamp: Date.now() },
        { id: '2', role: 'ai' as const, content: 'Ẹ kú aro', timestamp: Date.now() },
      ];

      const result = await evaluateConversation(mockScenario!, messages);

      expect(result.strength).toBeDefined();
      expect(result.improvement).toBeDefined();
      expect(result.correctedSentence).toBeDefined();
      expect(result.overallScore).toBeGreaterThanOrEqual(1);
      expect(result.overallScore).toBeLessThanOrEqual(10);
      expect(result.fluencyScore).toBeGreaterThanOrEqual(1);
      expect(result.grammarScore).toBeGreaterThanOrEqual(1);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(1);
    });
  });
});
```

## Mocking

**Framework:** Jest or Vitest (not yet configured, recommendation for future)

**Patterns (When Tests Are Implemented):**
- Mock external API calls: Google Gemini API, Google Cloud TTS
- Mock browser APIs: `navigator.mediaDevices.getUserMedia`, `SpeechRecognition`
- Mock Next.js server calls: `fetch` in hooks and components
- Mock React state updates

**Example Mocks:**
```typescript
// Mock Gemini API
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: jest.fn().mockResolvedValue({
        text: 'Mocked response',
      }),
    },
  })),
}));

// Mock browser SpeechRecognition
global.SpeechRecognition = jest.fn().mockImplementation(() => ({
  continuous: false,
  interimResults: false,
  lang: '',
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
  onstart: null,
  onend: null,
  onerror: null,
  onresult: null,
}));

// Mock fetch calls
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: jest.fn().mockResolvedValue({ transcription: 'hello' }),
});
```

**What to Mock:**
- External API calls (Gemini, Google Cloud)
- Browser APIs (MediaRecorder, SpeechRecognition, getUserMedia)
- Network requests (fetch to `/api/*` endpoints)
- Environment variables and secrets

**What NOT to Mock:**
- Core business logic within services
- Type definitions and interfaces
- Pure utility functions
- Next.js routing and navigation (use next/router mocks instead)

## Fixtures and Factories

**Test Data:**
```typescript
// src/types/test-fixtures.ts
import { Scenario, Message, Evaluation, DrillSession } from './index';

export const mockScenario: Scenario = {
  id: 'test-scenario',
  title: 'Test Scenario',
  titleYoruba: 'Ifẹ Test',
  description: 'A test scenario',
  icon: '🧪',
  context: 'Test context',
  aiRole: 'Test character',
  aiRoleYoruba: 'Test character Yoruba',
  starterPrompt: 'Hello user',
  difficulty: 'beginner',
  gender: 'female',
};

export const mockMessage = (overrides?: Partial<Message>): Message => ({
  id: '1',
  role: 'user',
  content: 'Test message',
  timestamp: Date.now(),
  ...overrides,
});

export const mockEvaluation = (overrides?: Partial<Evaluation>): Evaluation => ({
  strength: 'Good pronunciation',
  improvement: 'Use more Yoruba words',
  correctedSentence: 'Better way to say it',
  overallScore: 7,
  fluencyScore: 6,
  grammarScore: 7,
  confidenceScore: 8,
  ...overrides,
});

export const mockDrillSession = (overrides?: Partial<DrillSession>): DrillSession => ({
  id: '1',
  scenarioId: 'test-scenario',
  proficiencyLevel: 'beginner',
  messages: [],
  metrics: {
    speakingTimeSeconds: 120,
    turnCount: 5,
    meaningUnderstoodRate: 0.8,
    userUtterances: 5,
    aiUtterances: 5,
  },
  startTime: Date.now(),
  isActive: true,
  ...overrides,
});
```

**Location:**
- `src/types/test-fixtures.ts` or `src/__tests__/fixtures.ts`
- Import in test files: `import { mockScenario, mockMessage } from '@/types/test-fixtures'`

## Coverage

**Requirements:** Not currently enforced

**Recommended Targets (When Testing Implemented):**
- Statements: 80%+
- Branches: 70%+
- Functions: 80%+
- Lines: 80%+

**View Coverage (When Configured):**
```bash
npm run test:coverage    # Generate coverage report
npm run test:coverage -- --watch  # Watch mode with coverage
```

## Test Types

**Unit Tests:**
- Scope: Individual functions, hooks, components in isolation
- Approach: Test pure functions and side effects separately
- Example: `useSpeechRecognition()` hook with mocked browser API
- Coverage: Business logic, error handling, state transitions

**Integration Tests:**
- Scope: Multiple components/services working together
- Approach: Test API routes with mocked external services
- Example: User sends message → API processes → response returned
- Coverage: End-to-end user flows, data transformation

**E2E Tests:**
- Status: Not currently configured
- Recommendation: Use Playwright or Cypress when mature
- Scenarios to test: Market haggling conversation flow, feedback evaluation, scenario selection

## Common Patterns

**Async Testing:**
```typescript
// Hook async operations
it('should handle async speech recognition', async () => {
  const { result } = renderHook(() => useSpeechRecognition());

  await act(async () => {
    result.current.startListening();
    // Simulate audio event
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  expect(result.current.isListening).toBe(true);
});

// API async operations
it('should await partner response', async () => {
  const response = await getPartnerResponse(scenario, 'beginner', [], 'Hello');

  expect(response.reply).toBeDefined();
  expect(response.translation).toBeDefined();
});
```

**Error Testing:**
```typescript
// Network errors
it('should handle network errors gracefully', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

  const { result } = renderHook(() => useSpeechSynthesis());

  await act(async () => {
    result.current.speak('Test');
  });

  expect(result.current.isSpeaking).toBe(false);
});

// Gemini rate limiting
it('should retry on rate limit (429)', async () => {
  const calls: number[] = [];

  genAI.models.generateContent = jest.fn()
    .mockRejectedValueOnce({ status: 429 })
    .mockResolvedValueOnce({ text: 'Retry successful' });

  const result = await callGemini({
    contents: [{ role: 'user', parts: [{ text: 'Test' }] }],
  });

  expect(result).toBe('Retry successful');
  expect(genAI.models.generateContent).toHaveBeenCalledTimes(2);
});

// JSON parse errors
it('should handle malformed JSON responses', async () => {
  genAI.models.generateContent = jest.fn().mockResolvedValue({
    text: 'Invalid JSON',
  });

  const result = await getReplySuggestions(scenario, 'beginner', [], 'Test');

  expect(result).toEqual([
    { text: 'Ẹ ṣe o', translation: 'Thank you' },
    { text: 'Báwo ni?', translation: 'How is it?' },
  ]);
});
```

## Test Configuration Setup (When Implementing)

**Recommended Config for Jest:**
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coveragePathIgnorePatterns: ['/node_modules/', '/.next/'],
};
```

---

*Testing analysis: 2026-03-20*
