import { ProductData } from '../result';
import { Json, amountFrom, jsonLdNodes, metaContent, textOf, waitFor, watchText } from '../page-data';

/**
 * Blibli publishes JSON-LD, but its `offers` is the *promo* range: a captured
 * page showed `Rp185.000` in the DOM while JSON-LD said `lowPrice: 200000`.
 * The buyer's price is the element Blibli marks with
 * `data-testid="priceComponentOffered"`, which appears once per page.
 * See docs/superpowers/specs/2026-10-05-blibli-lazada-pdp-scrapers.md
 */

const PRICE_SELECTOR = '[data-testid="priceComponentOffered"]';
const PRICE_ROOT = '.product-price';
const PRICE_DEBOUNCE_MS = 150;

/** `Terjual 139` in the statistics block. */
const SOLD_SELECTOR = '.sold-seen-label';
const SOLD_LABEL = /terjual\s*([\d.,]+)/i;

const LD_TIMEOUT_MS = 6000;

/** The JSON-LD product block, preferring one that names the product. */
function productBlock(): Json | null {
  const blocks = jsonLdNodes('Product');
  return blocks.find((block) => typeof block.name === 'string' && block.name.trim() !== '')
    ?? blocks[0]
    ?? null;
}

/** `offers` is an AggregateOffer here; only a fallback for the DOM price. */
function offersPrice(offers: unknown): number | null {
  for (const offer of Array.isArray(offers) ? offers : [offers]) {
    if (!offer || typeof offer !== 'object') continue;
    const raw = (offer as Json).lowPrice ?? (offer as Json).price;
    const price = Number(raw);
    if (Number.isFinite(price) && price > 0) return price;
  }
  return null;
}

function visiblePrice(): number | null {
  return amountFrom(textOf(PRICE_SELECTOR));
}

function soldFromDom(): number | null {
  const match = SOLD_LABEL.exec(textOf(SOLD_SELECTOR));
  if (!match) return null;

  const value = Number(match[1].replace(/[.,]/g, ''));
  return Number.isFinite(value) ? value : null;
}

/** Calls `onChange` when the price changes, which a variant selection does. */
export function watchBlibliPrice(
  onChange: () => void,
  { debounceMs = PRICE_DEBOUNCE_MS }: { debounceMs?: number } = {},
): () => void {
  return watchText(PRICE_ROOT, () => textOf(PRICE_SELECTOR), onChange, { debounceMs });
}

export async function scrapeBlibliPDP(
  url: string,
  { timeoutMs = LD_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<ProductData | null> {
  try {
    const product = await waitFor(productBlock, timeoutMs);
    if (!product) {
      console.warn('Blibli product JSON-LD never appeared, scraping failed');
      return null;
    }

    const price = visiblePrice() ?? offersPrice(product.offers);
    if (price === null) {
      console.warn('Blibli found no usable price, scraping failed');
      return null;
    }

    const name = String(product.name ?? '').trim() || metaContent('og:title');
    if (!name) {
      console.warn('Blibli product name not found, scraping failed');
      return null;
    }

    // JSON-LD carries a thumbnail; the og tag carries the full-size image.
    const images = Array.isArray(product.image) ? product.image : [product.image];
    const imageUrl = metaContent('og:image')
      || String(images.find((src) => typeof src === 'string') ?? '');

    const rating = Number(product.aggregateRating?.ratingValue);
    const sold = soldFromDom();

    return {
      url,
      name: name.substring(0, 500),
      price,
      imageUrl: imageUrl.substring(0, 500),
      rating: Number.isFinite(rating) ? rating : null,
      sold: sold === null ? '' : String(sold),
    };
  } catch (error) {
    console.error('Error in scrapeBlibliPDP:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      url,
      timestamp: new Date().toISOString(),
    });
    return null;
  }
}
