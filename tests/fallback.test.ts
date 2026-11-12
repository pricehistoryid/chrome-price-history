import { beforeEach, describe, expect, it } from 'vitest';
import { extractWithFallback } from '../entrypoints/content/v3/scraper/fallback';

beforeEach(() => {
  document.body.innerHTML = '<section><h1> Product </h1><div class="price">Rp185.000</div><span>Terjual 12</span></section>';
});

describe('extractWithFallback', () => {
  it('reads CSS and XPath against the supplied context', () => {
    const section = document.querySelector('section')!;
    expect(extractWithFallback('h1', section)).toBe('Product');
    expect(extractWithFallback('./h1', section)).toBe('Product');
    expect(extractWithFallback('h1', document.createElement('div'))).toBeNull();
  });

  it('uses keyword heuristics only after the selected syntax returns nothing', () => {
    const section = document.querySelector('section')!;
    expect(extractWithFallback('.missing-price', section)).toBe('Rp185.000');
    expect(extractWithFallback('./missing-sold', section)).toBe('Terjual 12');
    expect(extractWithFallback('.missing-price', document.createElement('div'))).toBeNull();
  });
});
