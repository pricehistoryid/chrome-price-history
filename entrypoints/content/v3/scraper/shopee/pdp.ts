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

/**
 * The page is a React app and its `og:` tags carry react-helmet's `data-rh`
 * marker, so the structured data can arrive after the initial HTML. The
 * content script runs at document_end, which is why this waits instead of
 * reading once.
 */
const LD_TIMEOUT_MS = 6000;
const LD_POLL_MS = 150;

/** `189 Terjual`, and Shopee's abbreviated `1,2RB Terjual` above a thousand. */
const SOLD_LABEL = /([\d.,]+)\s*(rb|ribu)?\s*terjual/i;

/**
 * The product page keeps its price — or its price *range* — inside a single
 * `aria-live` region, and selecting a variant rewrites that text without
 * changing the URL. Both captured pages have exactly one such region. The
 * class names inside it are content-hashed, so the region is the anchor.
 */
const PRICE_SECTION = 'section[aria-live="polite"]';
const PRICE_TEXT = /^Rp\s?[\d.]+(?:\s*-\s*Rp\s?[\d.]+)?$/;
const PRICE_DEBOUNCE_MS = 150;

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

/** The JSON-LD product block, preferring one that names the product. */
function productBlock(): Json | null {
  const blocks = ldJsonProducts();
  return blocks.find((block) => typeof block.name === 'string' && block.name.trim() !== '')
    ?? blocks[0]
    ?? null;
}

/**
 * Polls until the product block shows up, so a client-rendered page is not
 * mistaken for an unsupported one. The price is read separately, because a
 * variant selection only ever moves the visible figure.
 */
function waitForProduct(timeoutMs: number): Promise<Json | null> {
  const immediate = productBlock();
  if (immediate) return Promise.resolve(immediate);

  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const timer = setInterval(() => {
      const found = productBlock();
      if (found || Date.now() >= deadline) {
        clearInterval(timer);
        resolve(found);
      }
    }, LD_POLL_MS);
  });
}

function priceSection(): Element | null {
  return document.querySelector(PRICE_SECTION);
}

/** The element whose whole text is a price or a price range, or ''. */
function priceTextIn(root: ParentNode): string {
  for (const el of root.querySelectorAll('div, span')) {
    const text = (el.textContent ?? '').trim();
    if (PRICE_TEXT.test(text)) return text;
  }
  return '';
}

function rupiahFigures(text: string): number[] {
  return (text.match(/[\d.]+/g) ?? [])
    .map((digits) => Number(digits.replace(/\./g, '')))
    .filter((value) => Number.isFinite(value) && value > 0);
}

/**
 * The price the buyer is looking at, which is the selected variant's — the low
 * end when the page still shows a range because nothing is selected. JSON-LD
 * cannot answer this: it stays at the aggregate range for the whole item.
 */
function visiblePrice(): number | null {
  const section = priceSection();
  if (!section) return null;

  const figures = rupiahFigures(priceTextIn(section));
  return figures.length > 0 ? Math.min(...figures) : null;
}

/**
 * Calls `onChange` when the price the user is looking at changes — selecting a
 * variant does that without a navigation, so no URL watcher can see it.
 * Returns a disposer; call it before arming another one.
 */
export function watchShopeePrice(
  onChange: () => void,
  { debounceMs = PRICE_DEBOUNCE_MS }: { debounceMs?: number } = {},
): () => void {
  const section = priceSection();
  if (!section) return () => {};

  let lastText = priceTextIn(section);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const observer = new MutationObserver(() => {
    const text = priceTextIn(section);
    if (text === lastText) return;

    lastText = text;
    clearTimeout(timer);
    timer = setTimeout(onChange, debounceMs);
  });

  observer.observe(section, { childList: true, subtree: true, characterData: true });

  return () => {
    clearTimeout(timer);
    observer.disconnect();
  };
}

export async function scrapeShopeePDP(
  url: string,
  { timeoutMs = LD_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<ProductData | null> {
  try {
    const product = await waitForProduct(timeoutMs);
    if (!product) {
      console.warn(
        ldJsonProducts().length > 0
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
