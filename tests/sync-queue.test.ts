import { describe, expect, it } from 'vitest';
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

describe('readQueue', () => {
  it('returns nothing for anything that is not an array', () => {
    expect(readQueue(undefined)).toEqual([]);
    expect(readQueue('nope')).toEqual([]);
    expect(readQueue({ url: 'x' })).toEqual([]);
  });

  it('drops entries that could not be uploaded', () => {
    expect(readQueue([price('a'), { url: 'b' }, null, price('c', NaN)])).toEqual([price('a')]);
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
