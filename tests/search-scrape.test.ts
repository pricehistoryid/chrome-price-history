import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scrapeSearch } from '../entrypoints/content/v3/scraper/tokopedia/search';

vi.mock('../entrypoints/content/v3/api', () => ({
  updateProductPrices: vi.fn(async () => {}),
  updateProductPrice: vi.fn(async () => {}),
}));

const PLACEHOLDER_IMAGE = 'https://images.tokopedia.net/img/85cc883d.svg';
const REAL_IMAGE = 'https://images.tokopedia.net/img/real-product.jpg';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
});

afterEach(() => {
  window.dispatchEvent(new Event('pagehide'));
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('scrapeSearch image handling', () => {
  it('keeps the settled product image', async () => {
    document.body.innerHTML =
      '<div class="css-5wh65g">' +
      `<a href="https://www.tokopedia.com/shop/sepatu-abc123"><img alt="product-image" src="${REAL_IMAGE}"></a>` +
      '<span data-testid="lblSRPProductProductName">Sepatu Sneakers</span>' +
      '<span data-testid="lblSRPProductPrice">Rp1.000.000</span>' +
      '</div>';

    const pending = scrapeSearch('https://www.tokopedia.com/search?q=sepatu');
    await vi.advanceTimersByTimeAsync(6000);
    const results = await pending;

    expect(results).toHaveLength(1);
    expect(results![0].imageUrl).toBe(REAL_IMAGE);
  });

  it('never persists the lazy-load placeholder URL', async () => {
    document.body.innerHTML =
      '<div class="css-5wh65g">' +
      `<a href="https://www.tokopedia.com/shop/tas-def456"><img alt="product-image" src="${PLACEHOLDER_IMAGE}"></a>` +
      '<span data-testid="lblSRPProductProductName">Tas Ransel</span>' +
      '<span data-testid="lblSRPProductPrice">Rp250.000</span>' +
      '</div>';

    const pending = scrapeSearch('https://www.tokopedia.com/search?q=tas');
    await vi.advanceTimersByTimeAsync(6000);
    const results = await pending;

    expect(results).toHaveLength(1);
    expect(results![0].imageUrl).toBe('');
    expect(results![0].name).toBe('Tas Ransel');
    expect(results![0].price).toBe('250000');
  });
});
