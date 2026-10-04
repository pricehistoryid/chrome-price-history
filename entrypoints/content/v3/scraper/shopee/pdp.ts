import { ProductData } from '../result';

/**
 * Shopee ships the product as JSON-LD in the server HTML, which is a far
 * steadier target than its content-hashed class names (`Ocv3B8`, `PfWbfd`).
 * Anchors verified against a captured product page — the shape, not the
 * values, is what tests pin. See
 * docs/superpowers/specs/2026-10-05-shopee-pdp-scraper-design.md
 *
 * The JSON-LD lives in <head> and is part of the initial response, so this
 * reads it without waiting: a MutationObserver on document.body would never
 * observe a head script appearing anyway.
 */

const LD_JSON_SELECTOR = 'script[type="application/ld+json"]';
const TITLE_SUFFIX = /\s*\|\s*Shopee Indonesia\s*$/i;

/** `189 Terjual`, and Shopee's abbreviated `1,2RB Terjual` above a thousand. */
const SOLD_LABEL = /([\d.,]+)\s*(rb|ribu)?\s*terjual/i;

type Json = Record<string, any>;

function ldJsonProducts(): Json[] {
  const products: Json[] = [];

  for (const script of document.querySelectorAll<HTMLScriptElement>(LD_JSON_SELECTOR)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(script.textContent ?? '');
    } catch {
      continue; // a malformed block must not stop the others
    }

    for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
      if (node && typeof node === 'object' && (node as Json)['@type'] === 'Product') {
        products.push(node as Json);
      }
    }
  }

  return products;
}

/**
 * `offers` is an AggregateOffer for products with variants (a price range) and
 * a plain Offer otherwise. The low end is what the listing advertises.
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

function metaContent(property: string): string {
  const el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  return el?.content?.trim() ?? '';
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

export async function scrapeShopeePDP(url: string): Promise<ProductData | null> {
  try {
    const product = ldJsonProducts().find((p) => typeof p.name === 'string' || p.offers);
    if (!product) {
      console.warn('Shopee product JSON-LD not found, scraping failed');
      return null;
    }

    const price = offersPrice(product.offers);
    if (price === null) {
      // Without a price there is nothing worth recording; guessing from the
      // DOM would risk storing a shipping fee or a struck-through figure.
      console.warn('Shopee price not found in JSON-LD, scraping failed');
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
