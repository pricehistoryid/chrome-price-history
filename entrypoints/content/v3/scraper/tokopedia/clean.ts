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
    magnifier: "[data-testid='PDPImageMagnifier'], img[alt^='Gambar']",
    rating: "[data-testid*='Rating']",
    sold: "[data-testid*='Sold']"
  },
  SEARCH: {
    card: "div.css-5wh65g",
    url: "a",
    name: "[data-testid='lblSRPProductProductName'], span.\\+tnoqZhn89\\+NHUA43BpiJg\\=\\=",
    price: "[data-testid='lblSRPProductPrice'], div.urMOIDHH7I0Iy1Dv2oFaNw\\=\\=",
    image: "img[alt='product-image'], .loWbMM9lKTafPiUjqt9UWA img",
    rating: "[data-testid*='Rating']",
    sold: "[data-testid*='Sold']"
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
 * Shared utility for scraping lists of products (Search, Wishlist).
 * ponytail: processors are sync DOM reads, run concurrently; cards that are not
 * rendered yet get one bounded re-pass instead of a fixed pre-pass sleep.
 */
export async function scrapeProductList(
  cardSelector: string,
  processor: (el: Element, index: number) => ProductData | null | Promise<ProductData | null>
): Promise<ProductData[]> {
  try {
    // ponytail: 2s matches the pre-race effective timeout
    const firstCard = await waitForElement<HTMLDivElement>(cardSelector, 2000);

    if (!firstCard) {
      console.warn(`Product cards ("${cardSelector}") not found within timeout`);
      return [];
    }

    // Get all product elements
    const productElements = Array.from(document.querySelectorAll(cardSelector));

    if (productElements.length === 0) {
      console.warn('No products found in the list');
      return [];
    }

    const results = await Promise.all(productElements.map((product, i) => processor(product, i)));

    const missing = results.map((res, i) => (res === null ? i : -1)).filter(i => i >= 0);
    if (missing.length > 0) {
      await sleep(800);
      const retried = await Promise.all(missing.map(i => processor(productElements[i], i)));
      missing.forEach((index, j) => { results[index] = retried[j]; });
    }

    return results.filter((res): res is ProductData => res !== null);
  } catch (error) {
    console.error('Error in scrapeProductList:', error);
    return [];
  }
}
