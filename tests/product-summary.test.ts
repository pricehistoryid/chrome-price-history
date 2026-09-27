import { describe, expect, it } from 'vitest';
import { buildProductSummary, findProductRecord } from '../entrypoints/popup/product-summary';

const KEY = 'https://www.tokopedia.com/shop-a/sepatu-abc123';

const record = {
  prevPrice: [{ time: '2026-08-12', price: 1000 }],
  lowestPrice: { time: '2026-08-12', price: 1000 },
};

describe('findProductRecord', () => {
  it('returns the record stored under the exact key', () => {
    expect(findProductRecord({ [KEY]: record }, KEY)).toBe(record);
  });

  it('finds a record stored under a legacy key carrying a query string', () => {
    expect(findProductRecord({ [`${KEY}?search_id=xyz`]: record }, KEY)).toBe(record);
  });

  it('finds a record stored under a legacy key with a trailing slash', () => {
    expect(findProductRecord({ [`${KEY}/`]: record }, KEY)).toBe(record);
  });

  it('prefers the exact key over a normalized match', () => {
    const normalizedOnly = { ...record, lowestPrice: { time: '2026-08-01', price: 900 } };
    const map = { [`${KEY}?q=1`]: normalizedOnly, [KEY]: record };
    expect(findProductRecord(map, KEY)).toBe(record);
  });

  it('returns null when the product is absent', () => {
    expect(findProductRecord({ 'https://www.tokopedia.com/other/x-y1': record }, KEY)).toBeNull();
  });

  it('returns null for unusable storage contents', () => {
    expect(findProductRecord(undefined, KEY)).toBeNull();
    expect(findProductRecord(null, KEY)).toBeNull();
    expect(findProductRecord('nope', KEY)).toBeNull();
    expect(findProductRecord([1, 2], KEY)).toBeNull();
    expect(findProductRecord({ [KEY]: { lowestPrice: record.lowestPrice } }, KEY)).toBeNull();
  });
});

describe('buildProductSummary', () => {
  it('reads the current price from the newest record and the delta from the previous one', () => {
    const summary = buildProductSummary({
      prevPrice: [
        { time: '2026-08-14', price: 1000 },
        { time: '2026-08-12', price: 1200 },
        { time: '2026-08-10', price: 1500 },
      ],
      lowestPrice: { time: '2026-08-14', price: 1000 },
    });

    expect(summary).toEqual({
      current: { time: '2026-08-14', price: 1000 },
      lowest: { time: '2026-08-14', price: 1000 },
      previous: { time: '2026-08-12', price: 1200 },
      delta: -200,
      recordCount: 3,
      firstSeen: '2026-08-10',
    });
  });

  it('has no delta when only one record exists', () => {
    const summary = buildProductSummary({
      prevPrice: [{ time: '2026-08-14', price: 1000 }],
      lowestPrice: { time: '2026-08-14', price: 1000 },
    });

    expect(summary?.delta).toBeNull();
    expect(summary?.previous).toBeNull();
    expect(summary?.recordCount).toBe(1);
    expect(summary?.firstSeen).toBe('2026-08-14');
  });

  it('migrates legacy value records', () => {
    const summary = buildProductSummary({
      prevPrice: [
        { time: '2026-08-14', value: '1000' },
        { time: '2026-08-12', value: '1200' },
      ],
      lowestPrice: { time: '2026-08-14', value: '1000' },
    });

    expect(summary?.current.price).toBe(1000);
    expect(summary?.delta).toBe(-200);
  });

  it('falls back to the current price when the lowest record is unusable', () => {
    const summary = buildProductSummary({
      prevPrice: [{ time: '2026-08-14', price: 1000 }],
      lowestPrice: { time: '2026-08-14' },
    });

    expect(summary?.lowest).toEqual({ time: '2026-08-14', price: 1000 });
  });

  it('returns null when there is nothing usable to show', () => {
    expect(buildProductSummary(null)).toBeNull();
    expect(buildProductSummary({ prevPrice: [], lowestPrice: { time: '2026-08-14', price: 1 } })).toBeNull();
    expect(buildProductSummary({ prevPrice: [{ time: '2026-08-14' }] })).toBeNull();
  });
});
