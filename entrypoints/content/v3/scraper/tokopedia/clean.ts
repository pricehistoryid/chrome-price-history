import { sleep, waitForElement } from '../../utils';
import { ProductData } from '../result';

/**
 * Tokopedia CSS/XPath Selectors Configuration
 */
export const TOKOPEDIA_SELECTORS = {
  PDP: {
    container: "#pdp_comp-product_content",
    name: "[data-testid='lblPDPDetailProductName']",
    price: "[data-testid='lblPDPDetailProductPrice']",
    magnifier: "[data-testid='PDPImageMagnifier']",
    rating: "[data-testid='lblPDPDetailProdukRating']",
    sold: "[data-testid='lblPDPDetailProdukSold']"
  },
  SEARCH: {
    card: "div.css-5wh65g",
    url: "a",
    name: "span.\\+tnoqZhn89\\+NHUA43BpiJg\\=\\=",
    price: "div.urMOIDHH7I0Iy1Dv2oFaNw\\=\\=",
    image: "img[alt='product-image']",
    rating: "span._2NfJxPu4JC-55aCJ8bEsyw\\=\\=",
    sold: "span.u6SfjDD2WiBlNW7zHmzRhQ\\=\\="
  },
  WISHLIST: {
    card: ".product__card, [data-testid='master-product-card']",
    url: "a.pcv3__info-content",
    name: "[data-testid='linkProductName']",
    price: "[data-testid='linkProductPrice']",
    image: ".pcv3_img_container img",
    rating: ".prd_rating-average-text, .prd_shop-rating-average-and-label .prd_rating-average-text",
    sold: ".prd_label-integrity"
  }
};

export function cleanPrice(price: string): string {
  return price
    .replaceAll('.', '')
    .replace(/[^0-9.-]+/g, '');
}

export function cleanImageUrl(imageUrl: string): string {
  return imageUrl
    .replace('url(', '')
    .replace(')', '')
    .replaceAll('"', '')
}

export function cleanSold(sold: string): string {
  const text = sold.replace(/Terjual|\+|\s/g, '');

  if (text.includes('rb')) {
    return Math.round(parseFloat(text.replace('rb', '').replace(',', '.')) * 1000).toString();
  }

  return text.replace(',', '.');
}

/**
 * Safely gets text content from an element
 */
export function safeGetTextContent(element: Element | null, selector?: string): string {
  try {
    if (!element) return '';
    if (selector) {
      const selected = element.querySelector(selector);
      return selected?.textContent?.trim() ?? '';
    }
    return element.textContent?.trim() ?? '';
  } catch (error) {
    console.warn('Error getting text content:', error);
    return '';
  }
}

/**
 * Safely gets text content from child nodes
 */
export function safeGetChildNodeText(parent: Element | null, childIndex: number): string {
  try {
    if (!parent || !parent.childNodes || parent.childNodes.length <= childIndex) {
      return '';
    }
    const childNode = parent.childNodes[childIndex];
    return childNode?.textContent?.trim() ?? '';
  } catch (error) {
    console.warn('Error getting child node text:', error);
    return '';
  }
}

/**
 * Safely gets href from an anchor element
 */
export function safeGetHref(element: Element | null, selector?: string): string {
  try {
    if (!element) return '';
    const selected = selector ? element.querySelector(selector) : element;
    return (selected as HTMLAnchorElement)?.href ?? '';
  } catch (error) {
    console.warn('Error getting href:', error);
    return '';
  }
}

/**
 * Safely gets src from an image element
 */
export function safeGetSrc(element: Element | null, selector?: string): string {
  try {
    if (!element) return '';
    const selected = selector ? element.querySelector(selector) : element;
    return (selected as HTMLImageElement)?.src ?? '';
  } catch (error) {
    console.warn('Error getting src:', error);
    return '';
  }
}

/**
 * Safely gets an attribute from an element
 */
export function safeGetAttribute(element: Element | null, attribute: string, selector?: string): string {
  try {
    if (!element) return '';
    const selected = selector ? element.querySelector(selector) : element;
    return selected?.getAttribute(attribute)?.trim() ?? '';
  } catch (error) {
    console.warn(`Error getting attribute ${attribute}:`, error);
    return '';
  }
}

/**
 * Safely gets innerHTML from an element
 */
export function safeGetInnerHtml(element: Element | null, selector?: string): string {
  try {
    if (!element) return '';
    if (selector) {
      const selected = element.querySelector(selector);
      return selected?.innerHTML?.trim() ?? '';
    }
    return element.innerHTML?.trim() ?? '';
  } catch (error) {
    console.warn('Error getting innerHTML:', error);
    return '';
  }
}

/**
 * Extracts product data from a card element (used in wishlist, search, etc.)
 */
export function extractProductFromCard(
  card: Element,
  selectors: {
    urlPath: string;
    namePath: string;
    pricePath: string;
    imagePath: string;
    ratingPath: string;
    soldPath: string;
  }
): ProductData {
  // Extract data with safety checks
  const url = safeGetHref(card, selectors.urlPath);
  const name = safeGetTextContent(card, selectors.namePath);
  const priceText = safeGetTextContent(card, selectors.pricePath);
  const imageSrc = safeGetSrc(card, selectors.imagePath);
  const rating = safeGetTextContent(card, selectors.ratingPath);
  const soldText = safeGetTextContent(card, selectors.soldPath);

  // Clean and validate data
  const price = cleanPrice(priceText);
  const imageUrl = cleanImageUrl(imageSrc);
  const sold = cleanSold(soldText);

  // Limit field lengths to prevent potential issues
  return {
    url: url.substring(0, 1000),
    name: name.substring(0, 500),
    price: price,
    imageUrl: imageUrl.substring(0, 500),
    rating: rating ? rating.substring(0, 10) : null,
    sold: sold.substring(0, 100)
  };
}

/**
 * Shared utility for scraping lists of products (Search, Wishlist)
 * Handles batching, delays, and error recovery.
 */
export async function scrapeProductList(
  cardSelector: string,
  processor: (el: Element, index: number) => Promise<ProductData | null>
): Promise<ProductData[]> {
  try {
    // Wait for at least one product card to appear
    const firstCard = await Promise.race([
      waitForElement<HTMLDivElement>(cardSelector),
      new Promise<HTMLDivElement | null>(resolve => {
        setTimeout(() => resolve(null), 5000); // 5 second timeout
      })
    ]);

    if (!firstCard) {
      console.warn(`Product cards ("${cardSelector}") not found within timeout`);
      return [];
    }

    // Wait a bit for dynamic content to load
    await sleep(1000);

    // Get all product elements
    const productElements = Array.from(document.querySelectorAll(cardSelector));

    if (productElements.length === 0) {
      console.warn('No products found in the list');
      return [];
    }

    // Process products in batches to avoid overwhelming the page
    const batchSize = 5;
    const results: ProductData[] = [];

    for (let i = 0; i < productElements.length; i += batchSize) {
      const batch = productElements.slice(i, i + batchSize);

      const batchPromises = batch.map((product, batchIndex) =>
        processor(product, i + batchIndex)
      );

      try {
        const batchResults = await Promise.all(batchPromises);
        // Filter out nulls from non-product elements
        for (const res of batchResults) {
          if (res) results.push(res);
        }

        // Small delay between batches to avoid rate limiting or UI freezing
        if (i + batchSize < productElements.length) {
          await sleep(200);
        }
      } catch (error) {
        console.error(`Error processing batch ${Math.floor(i / batchSize)}:`, error);
        // Continue with next batch even if one fails
      }
    }

    return results;

  } catch (error) {
    console.error('Error in scrapeProductList:', error);
    return [];
  }
}
