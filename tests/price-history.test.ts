import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_PRICE_POINTS,
  MAX_TRACKED_PRODUCTS,
  PriceHistory,
  migratePriceData,
  prunePriceHistory,
} from '../entrypoints/content/v3/price-history';

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
describe('migratePriceData', () => {
  it('converts a legacy value record to price', () => {
    expect(migratePriceData({ time: '2026-08-12', value: '15000' })).toEqual({
      time: '2026-08-12',
      price: 15000,
    });
  });

  it('returns a modern record unchanged, by identity', () => {
    const record = { time: '2026-08-12', price: 15000 };
    expect(migratePriceData(record)).toBe(record);
  });
});

function isoDaysAgo(days: number): string {
  return new Date(Date.UTC(2026, 0, 31) - days * 86_400_000).toISOString().slice(0, 10);
}

function points(count: number) {
  return Array.from({ length: count }, (_, i) => ({ time: isoDaysAgo(i), price: 1000 + i }));
}

function record(count: number) {
  return { prevPrice: points(count), lowestPrice: { time: isoDaysAgo(count), price: 900 } };
}

describe('prunePriceHistory', () => {
  it('keeps the newest points and drops the rest', () => {
    const pruned = prunePriceHistory({ product: record(MAX_PRICE_POINTS + 40) });

    expect(pruned.product.prevPrice).toHaveLength(MAX_PRICE_POINTS);
    expect(pruned.product.prevPrice[0].time).toBe(isoDaysAgo(0));
    expect(pruned.product.prevPrice.at(-1)?.time).toBe(isoDaysAgo(MAX_PRICE_POINTS - 1));
  });

  it('keeps the lowest price of a truncated product', () => {
    const pruned = prunePriceHistory({ product: record(MAX_PRICE_POINTS + 1) });

    expect(pruned.product.lowestPrice).toEqual({ time: isoDaysAgo(MAX_PRICE_POINTS + 1), price: 900 });
  });

  it('evicts the products visited longest ago', () => {
    const history: Record<string, ReturnType<typeof record>> = {};
    for (let i = 0; i < MAX_TRACKED_PRODUCTS + 5; i += 1) {
      history[`url-${i}`] = { prevPrice: [{ time: isoDaysAgo(i), price: 1000 }], lowestPrice: { time: isoDaysAgo(i), price: 1000 } };
    }

    const pruned = prunePriceHistory(history);
    const keys = Object.keys(pruned);

    expect(keys).toHaveLength(MAX_TRACKED_PRODUCTS);
    expect(keys).toContain('url-0');
    expect(keys).not.toContain(`url-${MAX_TRACKED_PRODUCTS + 4}`);
  });

  it('leaves a history that fits alone', () => {
    const history = { a: record(3), b: record(2) };

    expect(prunePriceHistory(history)).toEqual(history);
  });
});

describe('PriceHistory same-day handling', () => {
  const url = 'https://www.tokopedia.com/shop-a/sepatu-abc123';

  it('records the latest price of the day, including a higher one', async () => {
    const ph = new PriceHistory();
    const chart = { print: vi.fn() };

    await ph.save({ url, name: 'A', price: 100 }, chart);
    await ph.save({ url, name: 'A', price: 150 }, chart);

    const stored = store.price_history[url];
    expect(stored.prevPrice).toHaveLength(1);
    expect(stored.prevPrice[0].price).toBe(150);
    expect(stored.lowestPrice.price).toBe(100);
  });

  it('keeps the day lowest separate from a later rise', async () => {
    const ph = new PriceHistory();
    const chart = { print: vi.fn() };

    await ph.save({ url, name: 'A', price: 200 }, chart);
    await ph.save({ url, name: 'A', price: 120 }, chart);
    await ph.save({ url, name: 'A', price: 180 }, chart);

    const stored = store.price_history[url];
    expect(stored.prevPrice).toHaveLength(1);
    expect(stored.prevPrice[0].price).toBe(180);
    expect(stored.lowestPrice.price).toBe(120);
  });
});

describe('PriceHistory pruning', () => {
  it('trims the stored points when a product has grown past the cap', async () => {
    const url = 'https://www.tokopedia.com/shop-a/sepatu-abc123';
    store.price_history = { [url]: record(MAX_PRICE_POINTS + 35) };

    await new PriceHistory().save({ url, name: 'A', price: 777 }, { print: vi.fn() });

    const stored = store.price_history[url];
    expect(stored.prevPrice).toHaveLength(MAX_PRICE_POINTS);
    expect(stored.prevPrice[0].price).toBe(777);
  });
});
