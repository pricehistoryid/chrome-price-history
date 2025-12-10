import { waitForElement } from '../../utils';
import { ProductData } from '../result'
import { cleanImageUrl, cleanPrice, cleanSold } from './clean';

const namePath = "#pdp_comp-product_content"
const pricePath = ".price"
const magnifierPath = "#pdp_comp-product_media > div > div > button > div > div.magnifier"
const ratingPath = "#pdp_comp-product_content > div > div:nth-child(2) > div > p:nth-child(3) > span:nth-child(1) > span.main"
const soldPath = "#pdp_comp-product_content > div > div:nth-child(2) > div > div > div > p"

/**
 * Safely gets text content from an element
 */
function safeGetTextContent(element: Element | null, selector?: string): string {
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
function safeGetChildNodeText(parent: Element | null, childIndex: number): string {
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
 * Safely gets nested element text content
 */
function safeGetNestedText(element: Element | null, path: string[]): string {
  try {
    if (!element) return '';
    let current = element;

    for (const selector of path) {
      if (selector === 'firstElementChild') {
        current = current.firstElementChild;
      } else if (selector === 'textContent') {
        return current?.textContent?.trim() ?? '';
      } else {
        const next = current?.querySelector(selector);
        if (!next) return '';
        current = next;
      }

      if (!current) return '';
    }

    return current?.textContent?.trim() ?? '';
  } catch (error) {
    console.warn('Error getting nested text:', error);
    return '';
  }
}

export async function scrapePDP(url: string): Promise<ProductData | null> {
  try {
    // Wait for elements with timeout
    await Promise.race([
      waitForElement<HTMLDivElement>(namePath),
      new Promise(resolve => setTimeout(resolve, 5000))
    ]);

    // Use more robust selectors with fallbacks
    const nameEl = document.querySelector(namePath);
    const priceEl = document.querySelector(pricePath) || document.querySelector('[data-testid="lblPDPDetailProdukPrice"]');
    const magnifierEl = document.querySelector<HTMLElement>(magnifierPath) ||
                        document.querySelector<HTMLElement>('.magnifier') ||
                        document.querySelector<HTMLElement>('[data-testid="PDPImageMagnifier"]');
    const ratingEl = document.querySelector(ratingPath) ||
                    document.querySelector('[data-testid="lblPDPDetailProdukRating"]');
    const soldEl = document.querySelector(soldPath) ||
                  document.querySelector('[data-testid="lblPDPDetailProdukSold"]');

    // Extract data with safety checks
    const name = safeGetNestedText(nameEl, ['firstElementChild', 'firstElementChild']) ||
                safeGetTextContent(nameEl, 'h1') ||
                safeGetTextContent(document.querySelector('[data-testid="lblPDPDetailProdukName"]'));

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
      name: name.substring(0, 500), // Limit name length
      value: price,
      imageUrl: imageUrl.substring(0, 500), // Limit URL length
      rating: rating ? rating.substring(0, 10) : null, // Limit rating length
      sold: sold ? sold.substring(0, 50) : "" // Limit sold text length
    };

    console.log('Successfully scraped product:', { name, price: price, rating, sold });
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
