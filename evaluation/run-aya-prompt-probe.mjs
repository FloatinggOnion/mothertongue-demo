import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

// Exploratory probe only. The Yoruba instructions below require fluent-speaker
// review before they can be used in a controlled comparison or production.
process.loadEnvFile(new URL('../.env.local', import.meta.url));
const key = process.env.COHERE_API_KEY;
if (!key) throw new Error('COHERE_API_KEY is required');

const allCases = JSON.parse(readFileSync(new URL('./conversation-cases.json', import.meta.url), 'utf8'));
const cases = allCases.filter(({ id }) => ['market-order-english', 'market-price-code-switch'].includes(id));

const scene = "Mama Nkechi sells tomatoes at a Lagos market. She is a warm, shrewd market seller. The learner is her customer.";
const prompts = {
  english: [
    `You are Mama Nkechi in this scene: ${scene}`,
    'Answer the learner’s latest meaning; do not restart with a greeting.',
    'Speak only for Mama Nkechi. Reply only in Yoruba, in one short sentence.',
  ].join(' '),
  yoruba_draft: [
    `Ìwọ ni Mama Nkechi nínú ìṣẹ̀lẹ̀ yìí: ${scene}`,
    'Dáhùn sí ohun tí akẹ́kọ̀ọ́ sọ kẹ́yìn; má tún ìkíni bẹ̀rẹ̀.',
    'Sọ ọ̀rọ̀ Mama Nkechi nìkan. Dáhùn ní Yorùbá nìkan, ní gbólóhùn kúkúrú kan.',
  ].join(' '),
};

for (const testCase of cases) {
  for (const [variant, system] of Object.entries(prompts)) {
    const messages = [
      { role: 'system', content: system },
      ...testCase.history.map(({ role, content }) => ({ role: role === 'ai' ? 'assistant' : 'user', content })),
      { role: 'user', content: testCase.userMessage },
    ];
    const started = performance.now();
    let result;
    try {
      const response = await fetch('https://api.cohere.com/v2/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'tiny-aya-earth', temperature: 0.7, max_tokens: 64, messages }),
      });
      if (!response.ok) throw new Error(`Cohere returned HTTP ${response.status}`);
      const body = await response.json();
      result = {
        reply: body?.message?.content?.[0]?.text ?? '',
        finishReason: body?.finish_reason ?? null,
      };
    } catch (error) {
      result = { error: error instanceof Error ? error.message : String(error) };
    }
    process.stdout.write(JSON.stringify({
      caseId: testCase.id,
      variant,
      elapsedMs: Math.round(performance.now() - started),
      ...result,
    }) + '\n');
  }
}
