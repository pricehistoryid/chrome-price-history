import { ProductData } from '../result';
import { Json, amountsIn, jsonLdNodes, metaContent, waitFor, watchText } from '../page-data';

/**
 * Shopee ships the product as JSON-LD in the server HTML, which is a far
 * steadier target than its content-hashed class names (`Ocv3B8`, `PfWbfd`).
 * Anchors verified against two captured product pages — the shape, not the
 * values, is what tests pin. See
 * docs/superpowers/specs/2026-10-05-shopee-pdp-scraper-design.md
 *
 * The JSON-LD lives in <head> and can arrive after the initial HTML (the page's
 * `og:` tags carry react-helmet's `data-rh` marker), so the product block is
 * polled for rather than read once. The *price* never comes from it: JSON-LD
 * carries the item's range and does not move when a variant is selected.
 */

const TITLE_SUFFIX = /\s*\|\s*Shopee Indonesia\s*$/i;

const LD_TIMEOUT_MS = 6000;

/** `189 Terjual`, and Shopee's abbreviated `1,2RB Terjual` above a thousand. */
const SOLD_LABEL = /([\d.,]+)\s*(rb|ribu)?\s*terjual/i;

/** The price region, one per page in both captures, and its own text shape. */
const PRICE_SECTION = 'section[aria-live="polite"]';
const PRICE_TEXT = /^Rp\s?[\d.]+(?:\s*-\s*Rp\s?[\d.]+)?$/;
const PRICE_DEBOUNCE_MS = 150;

/** The JSON-LD product block, preferring one that names the product. */
function productBlock(): Json | null {
  const blocks = jsonLdNodes('Product');
  return blocks.find((block) => typeof block.name === 'string' && block.name.trim() !== '')
    ?? blocks[0]
    ?? null;
}

/**
 * `offers` is an AggregateOffer for products with variants (a price range) and
 * a plain Offer otherwise. Only used as a fallback.
 */
function offersPrice(offers: unknown): number | null {
  for (const offer of Array.isArray(offers) ? offers : [offers]) {
    if (!offer || typeof offer !== 'object') continue;
    const raw = (offer as Json).lowPrice ?? (offer as Json).price;
    const price = Number(raw);
    if (Number.isFinite(price) && price > 0) return price;
  }
  return null;
}

/** The element whose whole text is a price or a price range, or ''. */
function priceTextIn(root: ParentNode): string {
  for (const el of root.querySelectorAll('div, span')) {
    const text = (el.textContent ?? '').trim();
    if (PRICE_TEXT.test(text)) return text;
  }
  return '';
}

/**
 * The price the buyer is looking at, which is the selected variant's — the low
 * end when the page still shows a range because nothing is selected.
 */
function visiblePrice(): number | null {
  const section = document.querySelector(PRICE_SECTION);
  if (!section) return null;

  const figures = amountsIn(priceTextIn(section));
  return figures.length > 0 ? Math.min(...figures) : null;
}

function soldFromDom(): number | null {
  for (const el of document.querySelectorAll('div, span, button')) {
    const match = SOLD_LABEL.exec(el.textContent ?? '');
    if (!match) continue;

    // `1,2RB` is 1200, where the comma is a decimal point; `1.234` is 1234,
    // where the dot separates thousands.
    const value = match[2]
      ? Number(match[1].replace(/\./g, '').replace(',', '.')) * 1000
      : Number(match[1].replace(/[.,]/g, ''));

    if (Number.isFinite(value)) return value;
  }
  return null;
}

/**
 * Calls `onChange` when the price the user is looking at changes. Selecting a
 * variant does that without a navigation, so no URL watcher can see it.
 */
export function watchShopeePrice(
  onChange: () => void,
  { debounceMs = PRICE_DEBOUNCE_MS }: { debounceMs?: number } = {},
): () => void {
  return watchText(PRICE_SECTION, priceTextIn, onChange, { debounceMs });
}

export async function scrapeShopeePDP(
  url: string,
  { timeoutMs = LD_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<ProductData | null> {
  try {
    const product = await waitFor(productBlock, timeoutMs);
    if (!product) {
      console.warn(
        jsonLdNodes('Product').length > 0
          ? 'Shopee JSON-LD carried no product name, scraping failed'
          : 'Shopee product JSON-LD never appeared, scraping failed',
      );
      return null;
    }

    const price = visiblePrice() ?? offersPrice(product.offers);
    if (price === null) {
      console.warn('Shopee found no usable price, scraping failed');
      return null;
    }

    const name = String(product.name ?? '').trim() || metaContent('og:title').replace(TITLE_SUFFIX, '');
    if (!name) {
      console.warn('Shopee product name not found, scraping failed');
      return null;
    }

    const images = Array.isArray(product.image) ? product.image : [product.image];
    const imageUrl = String(images.find((src) => typeof src === 'string') ?? '') || metaContent('og:image');

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
    console.error('Error in scrapeShopeePDP:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      url,
      timestamp: new Date().toISOString(),
    });
    return null;
  }
}
