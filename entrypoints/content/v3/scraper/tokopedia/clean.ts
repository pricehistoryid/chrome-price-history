import { ProductData } from '../result';

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
