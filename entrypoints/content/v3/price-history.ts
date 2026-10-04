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

export class PriceHistory {
  private tzOffset: number;
  private ph: {
    prevPrice: PriceData[];
    lowestPrice: PriceData;
  } | undefined;
  // ponytail: serializes the read-modify-write in save()
  private queue: Promise<void> = Promise.resolve();

  constructor() {
    this.tzOffset = new Date().getTimezoneOffset() * 60000;
  }

  save(productData: ProductData, chart: { print: (data: any) => void }): Promise<void> {
    // Concurrent saves each read the whole price_history snapshot, so without
    // this chain the later write silently discards the other product's update.
    const next = this.queue.then(() => this.saveNow(productData, chart));
    this.queue = next.catch(() => {});
    return next;
  }

  private async saveNow(productData: ProductData, chart: { print: (data: any) => void }): Promise<void> {
    const url = productData.url;
    const date = new Date(Date.now() - this.tzOffset)
      .toISOString()
      .split('T')[0];

    const newData: PriceData = {
      time: date,
      price: Number(productData.price),
    };

    // ponytail: awaited so the storage write completes before this save resolves
    const result: any = await chrome.storage.local.get(['price_history']);
    const ph: any = result.price_history || {};

    let currentProduct = ph[url];

    if (currentProduct) {
      // Migrate existing data if needed
      currentProduct.prevPrice = (currentProduct.prevPrice || []).map((p: any) => migratePriceData(p));
      currentProduct.lowestPrice = migratePriceData(currentProduct.lowestPrice);
    }

    this.ph = currentProduct || { prevPrice: [], lowestPrice: newData };

    // Update lowest price if needed
    if (newData.price < this.ph!.lowestPrice.price) {
      this.ph!.lowestPrice = newData;
    }

    const latestPrice = this.ph!.prevPrice[0] || { price: 0, time: '' };

    // Add new data if it's different from the latest
    if (latestPrice.price !== newData.price || latestPrice.time !== newData.time) {
      if (latestPrice.time === newData.time && latestPrice.price > newData.price) {
        this.ph!.prevPrice[0].price = newData.price;
      } else if (latestPrice.time !== newData.time) {
        this.ph!.prevPrice.unshift(newData);
      }

      ph[url] = {
        prevPrice: this.ph!.prevPrice,
        lowestPrice: this.ph!.lowestPrice,
      };

      const pruned = prunePriceHistory(ph);
      await chrome.storage.local.set({ price_history: pruned });
      this.ph = pruned[url] ?? this.ph;
    }

    chart.print(this.ph);
  }

  render(chart: { print: (data: any) => void }): void {
    if (this.ph) {
      chart.print(this.ph);
    }
  }
}
