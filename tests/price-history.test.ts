import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PriceHistory } from '../entrypoints/content/v3/price-history';

type Stored = Record<string, any>;

let store: Stored;

beforeEach(() => {
  store = {};
  const local = (global as any).chrome.storage.local;
  // ponytail: stateful promise-based mock; the shared setup mock uses the callback form
  local.get = vi.fn(async (keys: string[]) => {
    const out: Stored = {};
    for (const key of keys) if (key in store) out[key] = store[key];
    return out;
  });
  local.set = vi.fn(async (items: Stored) => {
    Object.assign(store, items);
  });
});

describe('PriceHistory.save', () => {
  it('serializes concurrent saves so neither product loses its price', async () => {
    const ph = new PriceHistory();
    const chart = { print: vi.fn() };

    await Promise.all([
      ph.save({ url: 'https://www.tokopedia.com/shop-a/sepatu-abc123', name: 'A', price: 100 }, chart),
      ph.save({ url: 'https://www.tokopedia.com/shop-b/tas-def456', name: 'B', price: 200 }, chart),
    ]);

    const stored = store.price_history;
    expect(Object.keys(stored)).toHaveLength(2);
    expect(stored['https://www.tokopedia.com/shop-a/sepatu-abc123'].prevPrice[0].price).toBe(100);
    expect(stored['https://www.tokopedia.com/shop-b/tas-def456'].prevPrice[0].price).toBe(200);
  });
});
