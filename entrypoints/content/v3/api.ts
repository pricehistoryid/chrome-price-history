import { ProductData } from './scraper/result';
import { validateProductData } from './utils/validation';

// ponytail: server caps bulk at 100 items per POST
const MAX_BATCH = 100;

interface PricePayload {
  url: string;
  name: string;
  image_url: string;
  price: number;
  rating: number;
  sold: number;
}

function toPayload(productData: ProductData): PricePayload {
  const validatedProduct = validateProductData(productData);
  return {
    url: validatedProduct.url,
    name: validatedProduct.name,
    image_url: validatedProduct.imageUrl || '',
    price: parseInt(validatedProduct.price.toString()),
    rating: Number(validatedProduct.rating) || 0,
    sold: Number(validatedProduct.sold) || 0
  };
}

async function sendBatch(batch: PricePayload[]): Promise<void> {
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

  const valid: PricePayload[] = [];
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

  try {
    const chunks: PricePayload[][] = [];
    for (let i = 0; i < valid.length; i += MAX_BATCH) chunks.push(valid.slice(i, i + MAX_BATCH));
    // ponytail: allSettled so every batch is attempted and no sibling rejection goes unhandled
    const settled = await Promise.allSettled(chunks.map((batch) => sendBatch(batch)));
    const rejected = settled.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
    if (rejected) throw rejected.reason;
    // console.log('Prices updated successfully via background script');
  } catch (error) {
    // Provide detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    // Log error for debugging
    console.error('Failed to update product prices:', {
      error: errorMessage,
      itemCount: valid.length,
      timestamp: new Date().toISOString()
    });

    // ponytail: silent failure to avoid user confusion in chrome://extensions
  }
}

/**
 * Updates a single product price on the server (PDP path).
 */
export async function updateProductPrice(productData: ProductData): Promise<void> {
  await updateProductPrices([productData]);
}
