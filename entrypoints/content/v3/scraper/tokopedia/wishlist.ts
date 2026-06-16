import { sleep, waitForElement } from '../../utils';
import { ProductData } from '../result';
import { extractProductFromCard } from './clean';

const productCardSelector = '.product__card, [data-testid="master-product-card"]'
const urlPath = 'a.pcv3__info-content'
const namePath = '[data-testid="linkProductName"]'
const pricePath = '[data-testid="linkProductPrice"]'
const imagePath = '.pcv3_img_container img'
const ratingPath = '.prd_rating-average-text, .prd_shop-rating-average-and-label .prd_rating-average-text'
const soldPath = '.prd_label-integrity'

/**
 * Safely processes a single product element with error handling
 */
async function processProductElement(product: Element, index: number): Promise<ProductData> {
  try {
    const result = extractProductFromCard(product, {
      urlPath,
      namePath,
      pricePath,
      imagePath,
      ratingPath,
      soldPath
    });

    // Validate required fields
    if (!result.url || !result.name) {
      console.warn(`Product ${index} missing required data`, { url: result.url, name: result.name });
      return {
        ...result,
        name: result.name || `Product ${index}`,
        value: result.value || '0',
      };
    }

    return result;
  } catch (error) {
    console.error(`Error processing product ${index}:`, error);
    // Return safe fallback
    return {
      url: '',
      name: `Product ${index} (Error)`,
      value: '0',
      imageUrl: '',
      rating: null,
      sold: ''
    };
  }
}

export async function scrapeWishlist(): Promise<ProductData[] | null> {
  try {
    // console.log('Starting wishlist scraping...');

    // Wait for at least one product card to appear
    const firstCard = await Promise.race([
      waitForElement<HTMLDivElement>(productCardSelector),
      new Promise<HTMLDivElement | null>(resolve => {
        setTimeout(() => resolve(null), 5000); // 5 second timeout
      })
    ]);

    if (!firstCard) {
      console.warn('Product cards not found within timeout');
      return null;
    }

    // Wait a bit for dynamic content to load
    await sleep(1000);

    // Get all product elements
    const productElements = Array.from(document.querySelectorAll(productCardSelector));

    if (productElements.length === 0) {
      console.warn('No products found in wishlist');
      return [];
    }

    // console.log(`Found ${productElements.length} products to scrape`);

    // Process products in batches to avoid overwhelming the page
    const batchSize = 5;
    const results: ProductData[] = [];

    for (let i = 0; i < productElements.length; i += batchSize) {
      const batch = productElements.slice(i, i + batchSize);

      const batchPromises = batch.map((product, batchIndex) =>
        processProductElement(product, i + batchIndex)
      );

      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Small delay between batches to avoid rate limiting
        if (i + batchSize < productElements.length) {
          await sleep(200);
        }
      } catch (error) {
        console.error(`Error processing batch ${Math.floor(i / batchSize)}:`, error);
        // Continue with next batch even if one fails
      }
    }

    // Filter out invalid results
    const validResults = results.filter(product =>
      product.url && product.name && product.name !== ''
    );

    // console.log(`Successfully scraped ${validResults.length} out of ${productElements.length} products`);

    return validResults;

  } catch (error) {
    console.error('Error in scrapeWishlist:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    return null;
  }
}
