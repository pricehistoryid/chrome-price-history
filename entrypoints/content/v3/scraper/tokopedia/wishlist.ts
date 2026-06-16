import { ProductData } from '../result';
import { extractProductFromCard, scrapeProductList, TOKOPEDIA_SELECTORS } from './clean';

/**
 * Safely processes a single wishlist product element with error handling
 */
async function processWishlistElement(product: Element, index: number): Promise<ProductData | null> {
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

    // Validate required fields
    if (!result.url || !result.name) {
      console.warn(`Wishlist product ${index} missing required data`, { url: result.url, name: result.name });
      return {
        ...result,
        name: result.name || `Product ${index}`,
        price: result.price || '0',
      };
    }

    return result;
  } catch (error) {
    console.error(`Error processing wishlist product ${index}:`, error);
    return {
      url: '',
      name: `Product ${index} (Error)`,
      price: '0',
      imageUrl: '',
      rating: null,
      sold: ''
    };
  }
}

export async function scrapeWishlist(): Promise<ProductData[] | null> {
  const selectors = TOKOPEDIA_SELECTORS.WISHLIST;
  return await scrapeProductList(selectors.card, processWishlistElement);
}
