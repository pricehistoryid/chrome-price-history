/**
 * Prices the API refused to accept. They are kept locally so a later
 * successful request can deliver them, and so the popup can report a backlog.
 *
 * One owner for three things that must agree: the payload shape the content
 * script sends, the server's per-request batch limit, and the on-disk queue.
 */

export const SYNC_QUEUE_KEY = 'sync_queue';

/** The API accepts at most this many products per request. */
export const PRICE_BATCH_LIMIT = 100;

/**
 * ponytail: flat FIFO keyed by product URL, capped at 5000 entries (~1.2 KB
 * each worst case, so ~1 MB against a 10 MB storage quota). The cap is what
 * bounds an outage: search and wishlist pages enqueue up to 100 observations
 * per flush, so 500 was roughly one browsing session and the oldest were
 * evicted before the API came back. Evicting the oldest is the right loss
 * order; revisit if backlogs ever approach this cap.
 */
export const SYNC_QUEUE_MAX = 5000;

export interface QueuedPrice {
  url: string;
  name: string;
  image_url: string;
  price: number;
  rating: number;
  sold: number;
}

function isQueuedPrice(value: unknown): value is QueuedPrice {
  const candidate = value as Partial<QueuedPrice> | null;
  return (
    !!candidate &&
    typeof candidate === 'object' &&
    typeof candidate.url === 'string' &&
    candidate.url.length > 0 &&
    typeof candidate.name === 'string' &&
    typeof candidate.price === 'number' &&
    Number.isFinite(candidate.price)
  );
}

/** Reads a stored or incoming value, dropping anything malformed. */
export function readQueue(value: unknown): QueuedPrice[] {
  return Array.isArray(value) ? value.filter(isQueuedPrice) : [];
}

/**
 * Appends `incoming` to `queue`. The newest entry for a product URL wins, and
 * the oldest entries fall off past `SYNC_QUEUE_MAX`.
 */
export function mergeIntoQueue(queue: unknown, incoming: unknown): QueuedPrice[] {
  const byUrl = new Map<string, QueuedPrice>();
  for (const item of [...readQueue(queue), ...readQueue(incoming)]) byUrl.set(item.url, item);
  // Map preserves insertion order, so the survivors stay oldest-first.
  return [...byUrl.values()].slice(-SYNC_QUEUE_MAX);
}

export function pendingCount(queue: unknown): number {
  return readQueue(queue).length;
}

/** Splits a queue into server-sized requests, oldest first. */
export function batchForUpload(queue: QueuedPrice[]): QueuedPrice[][] {
  const batches: QueuedPrice[][] = [];
  for (let i = 0; i < queue.length; i += PRICE_BATCH_LIMIT) {
    batches.push(queue.slice(i, i + PRICE_BATCH_LIMIT));
  }
  return batches;
}
