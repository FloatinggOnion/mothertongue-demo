import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReplySuggestions } from './ReplySuggestions';

const suggestions = [{
  label: 'Ask the price',
  translation: 'How much are the tomatoes?',
  text: 'Èló ni tòmátì náà?',
}];

describe('progressive reply help', () => {
  const render = (step: 1 | 2 | 3) => renderToStaticMarkup(
    <ReplySuggestions suggestions={suggestions} step={step} onAdvance={() => {}} onSelect={() => {}} isVisible />
  );

  it('reveals intent before the English meaning or target phrase', () => {
    const html = render(1);
    expect(html).toContain('Ask the price');
    expect(html).not.toContain('How much are the tomatoes?');
    expect(html).not.toContain('Èló ni tòmátì náà?');
  });

  it('reveals the English meaning before the target phrase', () => {
    const html = render(2);
    expect(html).toContain('How much are the tomatoes?');
    expect(html).not.toContain('Èló ni tòmátì náà?');
  });

  it('offers the target phrase as an editable draft action', () => {
    const html = render(3);
    expect(html).toContain('Èló ni tòmátì náà?');
    expect(html).toContain('Use as draft');
  });
});
