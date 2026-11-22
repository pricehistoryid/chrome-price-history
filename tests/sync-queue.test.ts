import { describe, expect, it } from 'vitest';
import { validateProductData } from '../entrypoints/content/v3/utils/validation';
import {
  SYNC_QUEUE_MAX,
  batchForUpload,
  mergeIntoQueue,
  pendingCount,
  readQueue,
  type QueuedPrice,
} from '../shared/sync-queue';

function price(url: string, value = 1000): QueuedPrice {
  return { url, name: 'Product', image_url: '', price: value, rating: 0, sold: 0 };
}

function dated(url: string, observedAt: string, value = 1000): QueuedPrice {
  return { ...price(url, value), observed_at: observedAt };
}

describe('readQueue', () => {
  it('returns nothing for anything that is not an array', () => {
    expect(readQueue(undefined)).toEqual([]);
    expect(readQueue('nope')).toEqual([]);
    expect(readQueue({ url: 'x' })).toEqual([]);
  });

  it('drops entries that could not be uploaded', () => {
    expect(readQueue([price('a'), { url: 'b' }, null, price('c', NaN)])).toEqual([price('a')]);
  });

  it('drops queued zero prices before they can block a batch', () => {
    expect(readQueue([price('invalid', 0), price('valid', 1000)])).toEqual([price('valid', 1000)]);
  });

  it('keeps a YYYY-MM-DD day and drops anything else', () => {
    expect(readQueue([dated('keep', '2026-09-28')]).map((p) => p.observed_at)).toEqual(['2026-09-28']);
    // Entries queued before the field existed still drain, dated by arrival.
    expect(readQueue([price('legacy')]).map((p) => p.observed_at)).toEqual([undefined]);
    // A malformed day 400s the whole batch server-side, so it never leaves the queue.
    expect(readQueue([dated('a', '2026-9-1'), dated('b', '2026-09-28T00:00:00Z')])).toEqual([]);
  });
});

describe('mergeIntoQueue', () => {
  it('keeps the newest entry for a product URL without duplicating it', () => {
    expect(mergeIntoQueue([price('a', 1000), price('b', 2000)], [price('a', 3000)])).toEqual([
      price('a', 3000),
      price('b', 2000),
    ]);
  });

  it('appends new products after the ones already waiting', () => {
    expect(mergeIntoQueue([price('a')], [price('b')]).map((p) => p.url)).toEqual(['a', 'b']);
  });

  it('carries the day an observation was seen through a merge', () => {
    const merged = mergeIntoQueue([dated('a', '2026-09-20')], [dated('b', '2026-09-27')]);

    expect(merged).toEqual([dated('a', '2026-09-20'), dated('b', '2026-09-27')]);
    // Distinct days must both reach the account history after an outage.
    expect(mergeIntoQueue([dated('a', '2026-09-20')], [dated('a', '2026-09-28', 3000)])).toEqual([
      dated('a', '2026-09-20'), dated('a', '2026-09-28', 3000),
    ]);
  });

  it('treats a missing or malformed queue as empty', () => {
    expect(mergeIntoQueue(undefined, [price('a')])).toEqual([price('a')]);
    expect(mergeIntoQueue('garbage', [price('a')])).toEqual([price('a')]);
  });

  it('drops the oldest entries past the cap', () => {
    const full = Array.from({ length: SYNC_QUEUE_MAX }, (_, i) => price(`url-${i}`));

    const merged = mergeIntoQueue(full, [price('newcomer')]);

    expect(merged).toHaveLength(SYNC_QUEUE_MAX);
    expect(merged[0].url).toBe('url-1');
    expect(merged.at(-1)?.url).toBe('newcomer');
  });
});

describe('batchForUpload', () => {
  it('splits oldest-first into server-sized requests', () => {
    const batches = batchForUpload(Array.from({ length: 205 }, (_, i) => price(`url-${i}`)));

    expect(batches.map((batch) => batch.length)).toEqual([100, 100, 5]);
    expect(batches[0][0].url).toBe('url-0');
    expect(batches[2][0].url).toBe('url-200');
  });

  it('produces no batches for an empty queue', () => {
    expect(batchForUpload([])).toEqual([]);
  });
});

describe('pendingCount', () => {
  it('counts only entries that could be uploaded', () => {
    expect(pendingCount([price('a'), price('b'), { url: 'c' }])).toBe(2);
    expect(pendingCount(undefined)).toBe(0);
  });
});

describe('product upload validation', () => {
  it('rejects zero prices while accepting positive prices', () => {
    const product = { url: 'https://www.tokopedia.com/shop/item', name: 'Item', price: 0, imageUrl: '' };
    expect(() => validateProductData(product)).toThrow();
    expect(validateProductData({ ...product, price: 1000 }).price).toBe('1000');
  });

  it('rejects prices outside the API integer range and unsupported URL authority', () => {
    const product = { url: 'https://www.tokopedia.com/shop/item', name: 'Item', price: 2147483648, imageUrl: '' };
    expect(() => validateProductData(product)).toThrow();
    expect(() => validateProductData({ ...product, price: 1000, url: 'https://user:pass@www.tokopedia.com/shop/item' })).toThrow();
    expect(() => validateProductData({ ...product, price: 1000, url: 'https://www.tokopedia.com:444/shop/item' })).toThrow();
  });
});
