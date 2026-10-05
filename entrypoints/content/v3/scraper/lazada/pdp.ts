import { ProductData } from '../result';
import { Json, amountFrom, jsonLdNodes, metaContent, textOf, waitFor, watchText } from '../page-data';

/**
 * Lazada's JSON-LD carries identity only — its `offers` has a url, seller and
 * availability but **no price at all** — so the price always comes from the
 * DOM. A captured page showed the sale price as `1.845.000` next to a struck
 * through `Rp1.899.000`; the sale price is what a buyer pays.
 * See docs/superpowers/specs/2026-10-05-blibli-lazada-pdp-scrapers.md
 */

const PRICE_SELECTOR = '.pdp-v2-product-price-content-salePrice-amount';
const PRICE_ROOT = '.pdp-v2-product-price-content';
const PRICE_DEBOUNCE_MS = 150;

/**
 * Lazada's product photos live under `/kf/`, on either the file broker or the
 * image CDN; the store badges and other site art the page carries do not. Only
 * that path is accepted, since a badge stored as a product image is worse than
 * none.
 */
const PRODUCT_IMAGE = /\/kf\//;

/** The best product image the page offers, or '' rather than site art. */
function productImageUrl(): string {
  // Every Product block, not just the one carrying the name: a page can carry
  // several, and the image is not always on the same one.
  const fromLd = jsonLdNodes('Product')
    .flatMap((block) => (Array.isArray(block.image) ? block.image : [block.image]));

  for (const candidate of [...fromLd, metaContent('og:image')]) {
    if (typeof candidate === 'string' && PRODUCT_IMAGE.test(candidate)) return candidate;
  }
  return '';
}

const LD_TIMEOUT_MS = 6000;

/** The JSON-LD product block, preferring one that names the product. */
function productBlock(): Json | null {
  const blocks = jsonLdNodes('Product');
  return blocks.find((block) => typeof block.name === 'string' && block.name.trim() !== '')
    ?? blocks[0]
    ?? null;
}

function visiblePrice(): number | null {
  return amountFrom(textOf(PRICE_SELECTOR));
}

/** Calls `onChange` when the price changes, which a variant selection does. */
export function watchLazadaPrice(
  onChange: () => void,
  { debounceMs = PRICE_DEBOUNCE_MS }: { debounceMs?: number } = {},
): () => void {
  return watchText(PRICE_ROOT, () => textOf(PRICE_SELECTOR), onChange, { debounceMs });
}

export async function scrapeLazadaPDP(
  url: string,
  { timeoutMs = LD_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<ProductData | null> {
  try {
    const product = await waitFor(productBlock, timeoutMs);
    if (!product) {
      console.warn('Lazada product JSON-LD never appeared, scraping failed');
      return null;
    }

    const price = visiblePrice();
    if (price === null) {
      console.warn('Lazada found no usable price, scraping failed');
      return null;
    }

    const name = String(product.name ?? '').trim() || metaContent('og:title');
    if (!name) {
      console.warn('Lazada product name not found, scraping failed');
      return null;
    }

    const imageUrl = productImageUrl();
    if (!imageUrl) {
      console.warn('Lazada page offered no product image, storing none');
    }

    return {
      url,
      name: name.substring(0, 500),
      price,
      imageUrl: imageUrl.substring(0, 500),
      // The page shows the *store's* rating and lifetime sales ("40.2K Terjual
      // oleh Toko", "4.8/5" beside the store name), which are not this
      // product's figures. Reported as unknown rather than mis-attributed.
      rating: null,
      sold: '',
    };
  } catch (error) {
    console.error('Error in scrapeLazadaPDP:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      url,
      timestamp: new Date().toISOString(),
    });
    return null;
  }
}
