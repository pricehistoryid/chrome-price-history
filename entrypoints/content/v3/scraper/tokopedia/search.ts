import { ProductData } from '../result';
import { cleanSold, extractProductFromCard, scrapeProductList, TOKOPEDIA_SELECTORS } from './clean';

/**
 * Safely processes a single search result element with error handling
 */
async function processSearchElement(product: Element, index: number): Promise<ProductData | null> {
  const selectors = TOKOPEDIA_SELECTORS.SEARCH;
  try {
    const result = extractProductFromCard(product, {
      urlPath: selectors.url,
      namePath: selectors.name,
      pricePath: selectors.price,
      imagePath: selectors.image,
      ratingPath: selectors.rating,
      soldPath: selectors.sold
    });

    // Robust fallback for rating: use img[alt="rating"] as anchor
    if (!result.rating) {
      const ratingEl = product.querySelector('img[alt="rating"]')?.parentElement?.nextElementSibling;
      if (ratingEl) {
        result.rating = ratingEl.textContent?.trim()?.substring(0, 10) || null;
      }
    }

    // Robust fallback for sold: filter by text content "terjual"
    if (!result.sold) {
      const soldEl = Array.from(product.querySelectorAll('span')).find(el =>
        el.textContent?.toLowerCase().includes('terjual')
      );
      if (soldEl) {
        result.sold = cleanSold(soldEl.textContent?.trim() || '').substring(0, 100);
      }
    }

    // Validate required fields - if missing, it's likely not a valid product card
    if (!result.url || !result.name) {
      return null;
    }

    return result;
  } catch (error) {
    console.error(`Error processing search result product ${index}:`, error);
    return null;
  }
}

export async function scrapeSearch(_url: string): Promise<ProductData[] | null> {
  const selectors = TOKOPEDIA_SELECTORS.SEARCH;
  return await scrapeProductList(selectors.card, processSearchElement);
}
