import { localDateString } from './utils';

interface ProductData {
  url: string;
  name: string;
  price: number | string;
}

export interface PriceData {
  time: string;
  price: number;
}

interface StoredData {
  [url: string]: {
    prevPrice: PriceData[];
    lowestPrice: PriceData;
  };
}

/**
 * Pre-refactor records stored the price under `value`. The popup reads raw
 * storage, so it needs the same tolerance the save path has.
 */
export function migratePriceData(data: any): PriceData {
  if (data && data.value !== undefined && data.price === undefined) {
    return {
      time: data.time,
      price: Number(data.value)
    };
  }
  return data as PriceData;
}

export interface StoredProduct {
  prevPrice: PriceData[];
  lowestPrice: PriceData;
}

/** One point per price change, newest first. */
export const MAX_PRICE_POINTS = 365;

/**
 * ponytail: 200 products × 365 points ≈ 3 MB, inside the 10 MB
 * chrome.storage.local budget. Products are ranked by their newest price date,
 * so the ones you stopped visiting are the ones evicted. Add a real last-seen
 * field if eviction ever has to be exact.
 */
export const MAX_TRACKED_PRODUCTS = 200;

/**
 * Trims what the chart can draw: newest points per product, most recently
 * visited products. `lowestPrice` is stored separately, so it survives.
 */
export function prunePriceHistory(ph: Record<string, StoredProduct>): Record<string, StoredProduct> {
  const entries = Object.entries(ph).map(
    ([url, record]) =>
      [url, { ...record, prevPrice: record.prevPrice.slice(0, MAX_PRICE_POINTS) }] as const,
  );

  if (entries.length <= MAX_TRACKED_PRODUCTS) return Object.fromEntries(entries);

  return Object.fromEntries(
    entries
      .sort(([, a], [, b]) => (b.prevPrice[0]?.time ?? '').localeCompare(a.prevPrice[0]?.time ?? ''))
      .slice(0, MAX_TRACKED_PRODUCTS),
  );
}

/** Unions server days with local history; local observations win same-day conflicts. */
export function mergePriceHistory(
  local: StoredProduct | undefined,
  remote: PriceData[],
): StoredProduct | undefined {
  if (remote.length === 0) return local;

  const byDate = new Map<string, PriceData>();
  for (const point of remote) byDate.set(point.time, point);
  if (local) {
    for (let i = local.prevPrice.length - 1; i >= 0; i -= 1) {
      const point = local.prevPrice[i];
      byDate.set(point.time, point);
    }
  }

  const prevPrice = [...byDate.values()]
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, MAX_PRICE_POINTS);
  let lowestPrice = local?.lowestPrice ?? remote[0];
  for (const point of local?.prevPrice ?? []) {
    if (point.price < lowestPrice.price) lowestPrice = point;
  }
  for (const point of remote) {
    if (point.price < lowestPrice.price) lowestPrice = point;
  }

  return { prevPrice, lowestPrice };
}


export class PriceHistory {
  private ph: StoredProduct | undefined;
  private remoteHistory: StoredProduct | undefined;
  private remoteAccountId: string | undefined;
  private currentUrl: string | undefined;
  // ponytail: serializes the read-modify-write in save()
  private queue: Promise<void> = Promise.resolve();

  save(productData: ProductData, chart: { print: (data: StoredProduct) => void }): Promise<void> {
    const next = this.queue.then(() => this.saveNow(productData, chart));
    this.queue = next.catch(() => {});
    return next;
  }

  saveMany(products: ProductData[]): Promise<void> {
    const next = this.queue.then(async () => {
      const stored = await chrome.storage.local.get(['price_history']);
      const history = (stored.price_history ?? {}) as Record<string, StoredProduct>;
      const day = localDateString();
      let changed = false;
      for (const product of products) changed = this.recordPrice(history, product, day) || changed;
      if (changed) await chrome.storage.local.set({ price_history: prunePriceHistory(history) });
    });
    this.queue = next.catch(() => {});
    return next;
  }

  mergeRemote(url: string, remote: PriceData[], accountId: string): Promise<boolean> {
    return this.queue.then(() => {
      if (this.currentUrl !== url || !this.ph || !accountId || remote.length === 0) return false;
      this.remoteHistory = mergePriceHistory(this.ph, remote);
      this.remoteAccountId = accountId;
      return true;
    });
  }

  private recordPrice(history: Record<string, StoredProduct>, product: ProductData, day: string): boolean {
    const price = Number(product.price);
    if (!Number.isFinite(price) || price <= 0) return false;
    const observation = { time: day, price };
    const previous = history[product.url];
    const points = (previous?.prevPrice ?? []).map(migratePriceData);
    const lowest = previous?.lowestPrice ? migratePriceData(previous.lowestPrice) : observation;
    const latest = points[0];
    const changed = !latest || latest.time !== day || latest.price !== price;
    if (changed) {
      if (latest?.time === day) points[0] = observation;
      else points.unshift(observation);
    }
    history[product.url] = { prevPrice: points, lowestPrice: price < lowest.price ? observation : lowest };
    return changed;
  }

  private async saveNow(productData: ProductData, chart: { print: (data: StoredProduct) => void }): Promise<void> {
    const url = productData.url;
    if (this.currentUrl !== url) this.ph = undefined;
    this.currentUrl = url;
    this.remoteHistory = undefined;
    this.remoteAccountId = undefined;
    const result = await chrome.storage.local.get(['price_history']);
    const history = (result.price_history ?? {}) as Record<string, StoredProduct>;
    if (this.recordPrice(history, productData, localDateString())) {
      const pruned = prunePriceHistory(history);
      await chrome.storage.local.set({ price_history: pruned });
      this.ph = pruned[url] ?? history[url];
    } else {
      this.ph = history[url];
    }
    if (this.ph) chart.print(this.ph);
  }

  render(chart: { print: (data: StoredProduct) => void }, expectedUrl?: string, accountId?: string): void {
    if (!this.ph || (expectedUrl && this.currentUrl !== expectedUrl)) return;
    chart.print(accountId && accountId === this.remoteAccountId ? this.remoteHistory ?? this.ph : this.ph);
  }
}
