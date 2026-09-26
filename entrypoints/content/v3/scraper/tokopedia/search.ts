import { sleep, waitForElement } from '../../utils';
import { ProductData } from '../result';
import { cleanPrice, safeGetHref, TOKOPEDIA_SELECTORS } from './clean';
import { updateProductPrices } from '../../api';
import { FallbackRegistry } from '../fallback';

/**
 * Cache for processed product URLs to avoid duplicate API calls during search session
 */
const processedUrls = new Set<string>();

let observer: IntersectionObserver | null = null;
let mutationObserver: MutationObserver | null = null;
// ponytail: buffer scroll-triggered items into bulk flushes (20 items / 2s idle)
let pendingProducts: ProductData[] = [];
let flushTimer: number | undefined = undefined;

function scheduleFlush(): void {
  if (flushTimer !== undefined) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = undefined;
    const batch = pendingProducts;
    pendingProducts = [];
    if (batch.length > 0) void updateProductPrices(batch);
  }, 2000);
}

function queueProduct(product: ProductData): void {
  pendingProducts.push(product);
  if (pendingProducts.length >= 20) {
    if (flushTimer !== undefined) {
      window.clearTimeout(flushTimer);
      flushTimer = undefined;
    }
    const batch = pendingProducts;
    pendingProducts = [];
    void updateProductPrices(batch);
  } else {
    scheduleFlush();
  }
}

function flushPending(): void {
  if (flushTimer !== undefined) {
    window.clearTimeout(flushTimer);
    flushTimer = undefined;
  }
  const batch = pendingProducts;
  pendingProducts = [];
  if (batch.length > 0) void updateProductPrices(batch);
}

if (typeof window !== 'undefined') {
  // ponytail: the body-wide MutationObserver keeps firing after navigation away
  window.addEventListener('pagehide', () => {
    flushPending();
    observer?.disconnect();
    mutationObserver?.disconnect();
  });
}

/**
 * Safely processes a single search result element using FallbackRegistry and heuristics
 * ponytail: sync card parse; the caller resolves the lazy image
 */
function parseCard(product: Element, imageUrl: string): ProductData | null {
  const fallback = new FallbackRegistry();
  const selectors = TOKOPEDIA_SELECTORS.SEARCH;

  try {
    const name = fallback.execute(selectors.name, product);
    const priceText = fallback.execute(selectors.price, product);
    if (!name || !priceText) return null;

    const result: ProductData = {
      url: safeGetHref(product, selectors.url),
      name: name.substring(0, 500),
      price: cleanPrice(priceText),
      imageUrl,
      rating: fallback.execute(selectors.rating, product),
      sold: fallback.execute(selectors.sold, product)
    };

    // Validate required fields
    if (!result.url || !result.name || result.price === '0') return null;

    return result;
  } catch (error) {
    // console.warn('Error processing search element:', error);
    return null;
  }
}

// ponytail: Tokopedia shows a lazy-load placeholder before the real image settles
const PLACEHOLDER_IMAGE = '85cc883d.svg';
const IMAGE_POLL_MS = 200;
const IMAGE_POLL_TRIES = 8;
// ponytail: bound per-card retries so late-rendered cards are not silently dropped;
// IntersectionObserver does not re-deliver for an already-observed target.
const retryAttempts = new WeakMap<Element, number>();
const MAX_CARD_RETRIES = 3;

/**
 * Resolves the lazy-loaded card image; '' when it does not settle within the
 * bounded window (never the placeholder URL).
 */
async function resolveImageSrc(card: Element): Promise<string> {
  const selector = TOKOPEDIA_SELECTORS.SEARCH.image;
  for (let i = 0; i < IMAGE_POLL_TRIES; i++) {
    const src = (card.querySelector(selector) as HTMLImageElement | null)?.src ?? '';
    if (src && !src.includes(PLACEHOLDER_IMAGE)) return src;
    await sleep(IMAGE_POLL_MS);
  }
  return '';
}

/**
 * Resolves the image, parses the card, then queues it, retrying a bounded
 * number of times so late-rendered cards are not lost.
 */
async function processCard(card: Element): Promise<void> {
  const product = parseCard(card, await resolveImageSrc(card));

  if (product && !processedUrls.has(product.url)) {
    processedUrls.add(product.url);
    // Buffer scroll-triggered items into bulk flushes
    queueProduct(product);
    // Once successfully processed, stop observing this card
    observer?.unobserve(card);
    return;
  }

  if (!product) {
    const attempts = (retryAttempts.get(card) ?? 0) + 1;
    if (attempts <= MAX_CARD_RETRIES) {
      retryAttempts.set(card, attempts);
      window.setTimeout(() => void processCard(card), 500);
    }
  }
}

/**
 * Checks if an element is currently visible in the viewport
 */
function isElementInViewport(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Observes the search page for product cards and triggers scraping as they enter view,
 * while returning initially visible items immediately.
 */
export async function scrapeSearch(_url: string): Promise<ProductData[] | null> {
  const selectors = TOKOPEDIA_SELECTORS.SEARCH;

  // 1. Cleanup existing observers if re-initializing on URL change
  if (observer) observer.disconnect();
  if (mutationObserver) mutationObserver.disconnect();
  // ponytail: reset per-search state; SPA re-entry otherwise grows unbounded
  flushPending();
  processedUrls.clear();

  // Wait for an actual product link to appear (not just a skeleton card)
  const firstProductLink = await waitForElement<HTMLAnchorElement>(`${selectors.card} ${selectors.url}`, 2000);

  if (!firstProductLink) return [];

  // 2. Process initially visible cards concurrently (bounded per-card image poll)
  const initialCards = Array.from(document.querySelectorAll(selectors.card));
  const visibleCards = initialCards.filter(c => !c.classList.contains('IOLazyloading') && isElementInViewport(c));

  const initialResults: ProductData[] = [];

  const parsed = await Promise.all(visibleCards.map(async (card) => parseCard(card, await resolveImageSrc(card))));
  for (const product of parsed) {
    if (product && !processedUrls.has(product.url)) {
      processedUrls.add(product.url);
      initialResults.push(product);
    }
  }

  // 3. Setup IntersectionObserver for subsequent scrolling
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const card = entry.target;

      // Skip skeleton loaders
      if (card.classList.contains('IOLazyloading')) continue;

      // ponytail: bounded retries live in processCard; the observer never blocks on them
      void processCard(card);
    }
  }, {
    threshold: 0.1,
    rootMargin: '100px' // Start loading slightly before they enter view
  });

  // Function to observe currently visible cards
  const observeCards = () => {
    const cards = document.querySelectorAll(selectors.card);
    cards.forEach(c => {
      // Check if already processed to avoid re-observing
      const link = c.querySelector(selectors.url) as HTMLAnchorElement;
      if (link && !processedUrls.has(link.href) && observer) {
        observer.observe(c);
      }
    });
  };

  // Start observing
  observeCards();

  // Watch for dynamic card additions (Tokopedia's lazy loading/infinite scroll)
  mutationObserver = new MutationObserver(() => {
    observeCards();
  });

  mutationObserver.observe(document.body, { 
    childList: true, 
    subtree: true 
  });

  // Return the initially visible products to satisfy the caller (e.g. event-listener logs)
  return initialResults;
}
