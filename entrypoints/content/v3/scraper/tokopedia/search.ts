import { sleep, waitForElement } from '../../utils';
import { ProductData } from '../result';
import { cleanPrice, cleanSold, safeGetHref, TOKOPEDIA_SELECTORS } from './clean';
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
  window.addEventListener('pagehide', flushPending);
}

/**
 * Safely processes a single search result element using FallbackRegistry and heuristics
 */
async function processSearchElement(product: Element, _index: number): Promise<ProductData | null> {
  const fallback = new FallbackRegistry();
  const selectors = TOKOPEDIA_SELECTORS.SEARCH;

  try {
    const name = await fallback.execute(selectors.name, product);
    const priceText = await fallback.execute(selectors.price, product);
    
    // Fallback for image: use direct querySelector since it's more reliable for specific tags
    let imageEl = product.querySelector(selectors.image) as HTMLImageElement;
    let imageUrl = imageEl?.src || '';

    // Wait for lazy loaded image to replace placeholder
    if (imageUrl.includes('85cc883d.svg')) {
      for (let i = 0; i < 20; i++) { // Wait up to 4 seconds
        await sleep(200);
        imageEl = product.querySelector(selectors.image) as HTMLImageElement;
        if (imageEl?.src && !imageEl.src.includes('85cc883d.svg')) {
          imageUrl = imageEl.src;
          break;
        }
      }
    }
    
    if (!name || !priceText) {
      return null;
    }

    const result: ProductData = {
      url: safeGetHref(product, selectors.url),
      name: name.substring(0, 500),
      price: cleanPrice(priceText),
      imageUrl: imageUrl,
      rating: await fallback.execute(selectors.rating, product),
      sold: await fallback.execute(selectors.sold, product)
    };

    // Validate required fields
    if (!result.url || !result.name || result.price === '0') {
      return null;
    }

    return result;
  } catch (error) {
    // console.warn('Error processing search element:', error);
    return null;
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

  // Wait for an actual product link to appear (not just a skeleton card)
  const firstProductLink = await Promise.race([
    waitForElement<HTMLAnchorElement>(`${selectors.card} ${selectors.url}`),
    new Promise<HTMLAnchorElement | null>(resolve => {
      setTimeout(() => resolve(null), 5000);
    })
  ]);

  if (!firstProductLink) return [];
  await sleep(1000); // Allow time for images/text to populate

  // 2. Process initially visible cards to return immediately
  const initialCards = Array.from(document.querySelectorAll(selectors.card));
  const visibleCards = initialCards.filter(c => !c.classList.contains('IOLazyloading') && isElementInViewport(c));
  
  const initialResults: ProductData[] = [];
  
  for (const card of visibleCards) {
    const product = await processSearchElement(card, 0);
    if (product && !processedUrls.has(product.url)) {
      processedUrls.add(product.url);
      initialResults.push(product);
    }
  }

  // 3. Setup IntersectionObserver for subsequent scrolling
  observer = new IntersectionObserver((entries) => {
    entries.forEach(async (entry) => {
      if (entry.isIntersecting) {
        const card = entry.target;

        // Skip skeleton loaders
        if (card.classList.contains('IOLazyloading')) return;

        const product = await processSearchElement(card, 0);
        
        if (product && !processedUrls.has(product.url)) {
          processedUrls.add(product.url);
          // Buffer scroll-triggered items into bulk flushes
          queueProduct(product);
          
          // Once successfully processed, stop observing this card
          observer!.unobserve(card);
        }
      }
    });
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
