import { sleep, waitForElement } from '../../utils';
import { ProductData } from '../result';
import { cleanImageUrl, cleanPrice, cleanSold } from './clean';

const wishlistPath = 'div.content > div > div.content__grid > div > div:nth-child(1)'
const urlPath = '.pcv3__container > div > a'
const namePath = '.prd_link-product-name'
const pricePath = '.prd_link-product-price'
const imagePath = '.pcv3_img_container > img'
const ratingPath = ''
const soldPath = '.prd_label-integrity'

/**
 * Safely extracts text content with fallback
 */
function safeGetTextContent(element: Element | null): string {
  try {
    return element?.textContent?.trim() ?? '';
  } catch (error) {
    console.warn('Error getting text content:', error);
    return '';
  }
}

/**
 * Safely extracts href from anchor element
 */
function safeGetHref(element: Element | null): string {
  try {
    return (element as HTMLAnchorElement)?.href ?? '';
  } catch (error) {
    console.warn('Error getting href:', error);
    return '';
  }
}

/**
 * Safely extracts src from image element
 */
function safeGetSrc(element: Element | null): string {
  try {
    return (element as HTMLImageElement)?.src ?? '';
  } catch (error) {
    console.warn('Error getting src:', error);
    return '';
  }
}

/**
 * Safely processes a single product element with error handling
 */
async function processProductElement(product: Element, index: number): Promise<ProductData> {
  try {
    // Use batched queries for performance
    const elements = {
      urlEl: product.querySelector(urlPath),
      nameEl: product.querySelector(namePath),
      priceEl: product.querySelector(pricePath),
      imageUrlEl: product.querySelector(imagePath),
      soldEl: product.querySelector(soldPath)
    };

    // Extract data with safety checks
    const url = safeGetHref(elements.urlEl);
    const name = safeGetTextContent(elements.nameEl);
    const priceText = safeGetTextContent(elements.priceEl);
    const imageSrc = safeGetSrc(elements.imageUrlEl);
    const soldText = safeGetTextContent(elements.soldEl);

    // Clean and validate data
    const price = cleanPrice(priceText);
    const imageUrl = cleanImageUrl(imageSrc);
    const sold = cleanSold(soldText);

    // Validate required fields
    if (!url || !name) {
      console.warn(`Product ${index} missing required data`, { url, name });
      return {
        url: url || '',
        name: name || `Product ${index}`,
        value: '0',
        imageUrl: '',
        rating: null,
        sold: ''
      };
    }

    // Limit field lengths to prevent potential issues
    const result: ProductData = {
      url: url.substring(0, 1000), // Limit URL length
      name: name.substring(0, 500), // Limit name length
      value: price,
      imageUrl: imageUrl.substring(0, 500), // Limit image URL length
      rating: null,
      sold: sold.substring(0, 100) // Limit sold text length
    };

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
    console.log('Starting wishlist scraping...');

    // Wait for wishlist container with timeout
    const container = await Promise.race([
      waitForElement<HTMLDivElement>(wishlistPath),
      new Promise<HTMLDivElement | null>(resolve => {
        setTimeout(() => resolve(null), 5000); // 5 second timeout
      })
    ]);

    if (!container) {
      console.warn('Wishlist container not found within timeout');
      return null;
    }

    // Wait a bit for dynamic content to load
    await sleep(1000);

    // Get all product elements
    const productElements = Array.from(container.children);

    if (productElements.length === 0) {
      console.warn('No products found in wishlist');
      return [];
    }

    console.log(`Found ${productElements.length} products to scrape`);

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

    console.log(`Successfully scraped ${validResults.length} out of ${productElements.length} products`);

    return validResults;

  } catch (error) {
    console.error('Error in scrapeWishlist:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    return null;
  }
}