import { waitForElement } from '../../utils';
import { ProductData } from '../result'
import {
  cleanImageUrl,
  cleanPrice,
  safeGetTextContent,
  safeGetChildNodeText,
  TOKOPEDIA_SELECTORS
} from './clean';
import { extractWithFallback } from '../fallback';

export async function scrapePDP(url: string): Promise<ProductData | null> {
  const selectors = TOKOPEDIA_SELECTORS.PDP;

  try {
    // ponytail: waitForElement already times out; 2s matches the pre-race effective timeout
    await waitForElement<HTMLDivElement>(selectors.container, 2000);

    // Try multiple selectors for name via fallback extraction
    const name = extractWithFallback(selectors.name) ||
                 extractWithFallback('h1') || '';

    // Use robust selectors with fallbacks
    const priceEl = document.querySelector(selectors.price) || document.querySelector('.price');
    const magnifierEl = document.querySelector<HTMLElement>(selectors.magnifier) ||
                        document.querySelector<HTMLElement>('.magnifier');
    const ratingEl = document.querySelector(selectors.rating);
    const soldEl = document.querySelector(selectors.sold);

    const priceText = safeGetTextContent(priceEl) ||
      document.querySelector<HTMLMetaElement>('meta[property="product:price:amount"]')?.content || '';
    const price = cleanPrice(priceText);

    let imageUrl = "";
    if (magnifierEl) {
      if (magnifierEl instanceof HTMLImageElement) {
        imageUrl = magnifierEl.src;
      } else {
        imageUrl = cleanImageUrl(magnifierEl.style.backgroundImage);
      }
    }

    const rating = safeGetTextContent(ratingEl);
    const sold = safeGetChildNodeText(soldEl, 2) || safeGetTextContent(soldEl);

    // Validate that we have at least a name and price
    if (!name || name.length === 0) {
      console.warn('Product name not found, scraping failed');
      return null;
    }

    if (!(Number(price) > 0)) {
      console.warn('Product price not found or invalid');
      return null;
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
