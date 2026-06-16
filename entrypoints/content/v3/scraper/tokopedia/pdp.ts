import { waitForElement } from '../../utils';
import { ProductData } from '../result'
import {
  cleanImageUrl,
  cleanPrice,
  safeGetTextContent,
  safeGetChildNodeText,
  TOKOPEDIA_SELECTORS
} from './clean';
import { FallbackRegistry } from '../fallback';

export async function scrapePDP(url: string): Promise<ProductData | null> {
  const fallback = new FallbackRegistry();
  const selectors = TOKOPEDIA_SELECTORS.PDP;

  try {
    // Wait for container element with timeout
    await Promise.race([
      waitForElement<HTMLDivElement>(selectors.container),
      new Promise(resolve => setTimeout(resolve, 5000))
    ]);

    // Try multiple selectors for name via fallback registry
    const name = await fallback.execute(selectors.name) ||
                 await fallback.execute('h1') || '';

    // Use robust selectors with fallbacks
    const priceEl = document.querySelector(selectors.price) || document.querySelector('.price');
    const magnifierEl = document.querySelector<HTMLElement>(selectors.magnifier) ||
                        document.querySelector<HTMLElement>('.magnifier');
    const ratingEl = document.querySelector(selectors.rating);
    const soldEl = document.querySelector(selectors.sold);

    const priceText = safeGetTextContent(priceEl);
    const price = priceText ? cleanPrice(priceText) : "0";

    const imageUrl = magnifierEl ? cleanImageUrl(magnifierEl.style.backgroundImage) : "";

    const rating = safeGetTextContent(ratingEl);
    const sold = safeGetChildNodeText(soldEl, 2) || safeGetTextContent(soldEl);

    // Validate that we have at least a name and price
    if (!name || name.length === 0) {
      console.warn('Product name not found, scraping failed');
      return null;
    }

    if (price === "0" || !price) {
      console.warn('Product price not found or invalid');
    }

    const result = {
      url,
      name: name.substring(0, 500),
      price: price,
      imageUrl: imageUrl.substring(0, 500),
      rating: rating ? rating.substring(0, 10) : null,
      sold: sold ? sold.substring(0, 50) : ""
    };

    return result;

  } catch (error) {
    console.error('Error in scrapePDP:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      url,
      timestamp: new Date().toISOString()
    });
    return null;
  }
}
