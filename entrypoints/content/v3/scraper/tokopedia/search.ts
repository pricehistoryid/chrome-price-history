import { sleep, waitForElement } from '../../utils';
import { ProductData } from '../result';
import { cleanSold, extractProductFromCard } from './clean';

const productCardSelector = 'div.css-5wh65g'
const urlPath = 'a'
const namePath = 'span.\\+tnoqZhn89\\+NHUA43BpiJg\\=\\='
const pricePath = 'div.urMOIDHH7I0Iy1Dv2oFaNw\\=\\='
const imagePath = 'img[alt="product-image"]'
const ratingPath = 'span._2NfJxPu4JC-55aCJ8bEsyw\\=\\='
const soldPath = 'span.u6SfjDD2WiBlNW7zHmzRhQ\\=\\='

/**
 * Safely processes a single product element with error handling
 */
async function processProductElement(product: Element, index: number): Promise<ProductData | null> {
  try {
    const result = extractProductFromCard(product, {
      urlPath,
      namePath,
      pricePath,
      imagePath,
      ratingPath,
      soldPath
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

    // Validate required fields - if missing, it's likely not a valid product card (e.g. skeleton or ad)
    if (!result.url || !result.name) {
      // Silently return null for non-product elements to avoid console noise
      return null;
    }

    return result;
  } catch (error) {
    console.error(`Error processing search result product ${index}:`, error);
    return null;
  }
}

export async function scrapeSearch(url: string): Promise<ProductData[] | null> {
  try {
    // console.log('Starting search result scraping for:', url);

    // Wait for at least one product card to appear
    const firstCard = await Promise.race([
      waitForElement<HTMLDivElement>(productCardSelector),
      new Promise<HTMLDivElement | null>(resolve => {
        setTimeout(() => resolve(null), 5000); // 5 second timeout
      })
    ]);

    if (!firstCard) {
      console.warn('Search product cards not found within timeout');
      return null;
    }

    // Wait a bit for dynamic content to load
    await sleep(1000);

    // Get all product elements
    const productElements = Array.from(document.querySelectorAll(productCardSelector));

    if (productElements.length === 0) {
      console.warn('No products found in search results');
      return [];
    }

    // console.log(`Found ${productElements.length} search elements to evaluate`);

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
        // Filter out nulls from non-product elements
        for (const res of batchResults) {
          if (res) results.push(res);
        }

        // Small delay between batches to avoid rate limiting
        if (i + batchSize < productElements.length) {
          await sleep(200);
        }
      } catch (error) {
        console.error(`Error processing batch ${Math.floor(i / batchSize)}:`, error);
      }
    }

    // console.log(`Successfully scraped ${results.length} out of ${productElements.length} elements`);

    return results;

  } catch (error) {
    console.error('Error in scrapeSearch:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      url,
      timestamp: new Date().toISOString()
    });
    return null;
  }
}
