import { migratePriceData, type PriceData, type StoredProduct } from '../content/v3/price-history';

export type { StoredProduct };

/** Keys written by earlier builds may carry a query string, hash, or trailing slash. */
function stripKeyNoise(key: string): string {
  return key.replace(/[?#].*$/, '').replace(/\/$/, '');
}

function isStoredProduct(value: unknown): value is StoredProduct {
  if (!value || typeof value !== 'object') return false;
  return Array.isArray((value as Partial<StoredProduct>).prevPrice);
}

/**
 * Exact key first, then a normalized scan so legacy key shapes still resolve
 * instead of silently reading as "no data".
 */
export function findProductRecord(priceHistory: unknown, productKey: string): StoredProduct | null {
  if (!priceHistory || typeof priceHistory !== 'object' || Array.isArray(priceHistory)) return null;
  const map = priceHistory as Record<string, unknown>;

  const exact = map[productKey];
  if (isStoredProduct(exact)) return exact;

  const needle = stripKeyNoise(productKey);
  for (const [key, value] of Object.entries(map)) {
    if (stripKeyNoise(key) === needle && isStoredProduct(value)) return value;
  }
  return null;
}

export interface ProductSummary {
  current: PriceData;
  lowest: PriceData;
  previous: PriceData | null;
  delta: number | null;
  recordCount: number;
  firstSeen: string;
}

function isPriceData(value: unknown): value is PriceData {
  const candidate = value as Partial<PriceData> | null;
  return (
    !!candidate &&
    typeof candidate.time === 'string' &&
    typeof candidate.price === 'number' &&
    Number.isFinite(candidate.price)
  );
}

/**
 * `prevPrice` is newest-first, and a same-day price drop rewrites index 0, so
 * index 0 is the current price. Returns null when there is nothing usable.
 */
export function buildProductSummary(record: unknown): ProductSummary | null {
  if (!isStoredProduct(record)) return null;

  const prices = record.prevPrice.map(entry => migratePriceData(entry)).filter(isPriceData);
  if (prices.length === 0) return null;

  const current = prices[0];
  const previous = prices[1] ?? null;
  const storedLowest = migratePriceData(record.lowestPrice);

  return {
    current,
    lowest: isPriceData(storedLowest) ? storedLowest : current,
    previous,
    delta: previous ? current.price - previous.price : null,
    recordCount: prices.length,
    firstSeen: prices[prices.length - 1].time,
  };
}
