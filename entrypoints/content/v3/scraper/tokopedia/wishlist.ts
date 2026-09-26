import { ProductData } from '../result';
import { extractProductFromCard, scrapeProductList, TOKOPEDIA_SELECTORS } from './clean';

/**
 * Safely processes a single wishlist product element with error handling
 * ponytail: sync DOM read, zero awaits
 */
function processWishlistElement(product: Element, index: number): ProductData | null {
  const selectors = TOKOPEDIA_SELECTORS.WISHLIST;
  try {
    const result = extractProductFromCard(product, {
      urlPath: selectors.url,
      namePath: selectors.name,
      pricePath: selectors.price,
      imagePath: selectors.image,
      ratingPath: selectors.rating,
      soldPath: selectors.sold
    });

    // ponytail: no synthetic "Product N" rows; unrendered cards are re-passed by scrapeProductList
    if (!result.url || !result.name) {
      console.warn(`Wishlist product ${index} missing required data`, { url: result.url, name: result.name });
      return null;
    }

    return result;
  } catch (error) {
    console.error(`Error processing wishlist product ${index}:`, error);
    return null;
  }
}

export async function scrapeWishlist(): Promise<ProductData[] | null> {
  const selectors = TOKOPEDIA_SELECTORS.WISHLIST;
  return await scrapeProductList(selectors.card, processWishlistElement);
}
