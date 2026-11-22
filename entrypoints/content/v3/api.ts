import { ProductData } from './scraper/result';
import { validateProductData } from './utils/validation';
import { localDateString } from './utils';
import type { PriceData } from './price-history';
import { batchForUpload, type QueuedPrice } from '../../../shared/sync-queue';

function toPayload(productData: ProductData): QueuedPrice {
  const validatedProduct = validateProductData(productData);
  return {
    url: validatedProduct.url,
    name: validatedProduct.name,
    image_url: validatedProduct.imageUrl || '',
    price: parseInt(validatedProduct.price.toString()),
    rating: Number(validatedProduct.rating) || 0,
    sold: Number(validatedProduct.sold) || 0,
    // The day the price was seen, so a batch the API rejects today is still
    // dated correctly when the retry queue drains it days later.
    observed_at: localDateString()
  };
}

async function sendBatch(batch: QueuedPrice[]): Promise<void> {
  // Send message to background script to perform the actual fetch
  const response: { success: boolean; data?: unknown; error?: string } = await chrome.runtime.sendMessage({
    type: 'UPDATE_PRODUCT_PRICE',
    payload: batch
  });

  if (!response.success) {
    throw new Error(response.error || 'Unknown error occurred in background script');
  }
}

/**
 * Sends product prices to the server via the background service worker
 * to bypass CORS and Private Network Access restrictions.
 * Batches into a single array POST per 100 items (server bulk limit).
 */
export async function updateProductPrices(products: ProductData[]): Promise<void> {
  if (products.length === 0) return;

  const valid: QueuedPrice[] = [];
  for (const product of products) {
    try {
      valid.push(toPayload(product));
    } catch (error) {
      // Skip one bad item, keep the rest of the batch
      console.warn('Skipping invalid product:', {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        productUrl: product.url
      });
    }
  }

  if (valid.length === 0) return;

  // ponytail: allSettled so every batch is attempted and no sibling rejection goes unhandled
  const settled = await Promise.allSettled(batchForUpload(valid).map((batch) => sendBatch(batch)));
  const failed = settled.filter((result) => result.status === 'rejected');

  if (failed.length > 0) {
    // A failed background request may be queued for its original account;
    // local history remains available even when account sync is unavailable.
    console.error('Failed to update product prices:', {
      error: failed.map((result) => (result as PromiseRejectedResult).reason?.message ?? 'Unknown error occurred'),
      itemCount: valid.length,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Updates a single product price on the server (PDP path).
 */
export async function updateProductPrice(productData: ProductData): Promise<void> {
  await updateProductPrices([productData]);
}

/** Unavailable or signed-out endpoints leave local prices untouched. */
export async function getProductPriceHistory(url: string): Promise<{ accountId: string | null; prices: PriceData[] }> {
  try {
    const response: unknown = await chrome.runtime.sendMessage({ type: 'GET_PRODUCT_PRICE_HISTORY', url });
    if (!response || typeof response !== 'object' || !('success' in response) || response.success !== true ||
      !('accountId' in response) || typeof response.accountId !== 'string' ||
      !('data' in response) || !Array.isArray(response.data)) return { accountId: null, prices: [] };
    return { accountId: response.accountId, prices: response.data as PriceData[] };
  } catch {
    return { accountId: null, prices: [] };
  }
}
