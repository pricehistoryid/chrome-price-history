import { isSupportedHost } from '../../../../shared/page-url';
import { ProductData } from '../scraper/result';

/**
 * Sanitizes and validates a URL
 */
export function validateAndSanitizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL: URL must be a non-empty string');
  }

  // Basic URL validation
  try {
    const urlObj = new URL(url);
    // Only allow https protocols
    if (urlObj.protocol !== 'https:') {
      throw new Error('Invalid URL: Only HTTPS URLs are allowed');
    }
    const normalized = urlObj.toString();
    if (!isSupportedHost(urlObj.hostname) || urlObj.username || urlObj.password || urlObj.port || normalized.length > 2048) {
      throw new Error('Invalid URL: Domain or URL authority not allowed');
    }
    return normalized;
  } catch (error) {
    throw new Error(`Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Sanitizes product name
 */
export function sanitizeProductName(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new Error('Invalid product name: Name must be a non-empty string');
  }

  // Remove HTML tags and sanitize
  const cleanName = name
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim()
    .substring(0, 500); // Limit length

  if (cleanName.length === 0) {
    throw new Error('Invalid product name: Name cannot be empty after sanitization');
  }

  return cleanName;
}

/**
 * Validates and sanitizes image URL
 */
export function validateAndSanitizeImageUrl(imageUrl?: string): string {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return '';
  }

  try {
    const urlObj = new URL(imageUrl);
    // Only allow https or data URLs for images
    if (urlObj.protocol !== 'https:' && !urlObj.protocol.startsWith('data:')) {
      throw new Error('Invalid image URL: Only HTTPS or data URLs are allowed');
    }
    return urlObj.toString();
  } catch {
    return '';
  }
}

/**
 * Validates and parses price value
 */
export function validateAndParsePrice(price: string | number): number {
  if (price === null || price === undefined) {
    throw new Error('Invalid price: Price cannot be null or undefined');
  }

  // Convert to string and clean
  const priceStr = price.toString().replace(/[^\d]/g, '');
  const parsedPrice = parseInt(priceStr);

  if (isNaN(parsedPrice)) {
    throw new Error('Invalid price: Cannot parse price value');
  }

  if (parsedPrice <= 0) {
    throw new Error('Invalid price: Price must be greater than zero');
  }

  if (parsedPrice > 2_147_483_647) {
    throw new Error('Invalid price: Price exceeds API integer limit');
  }

  return parsedPrice;
}

/**
 * Validates and parses rating
 */
export function validateAndParseRating(rating?: string | number | null): number | null {
  if (rating === null || rating === undefined || rating === '') {
    return null;
  }

  const parsedRating = parseFloat(rating.toString());

  if (isNaN(parsedRating)) {
    return null;
  }

  if (parsedRating < 0 || parsedRating > 5) {
    return null;
  }

  return Math.round(parsedRating * 10) / 10; // Round to 1 decimal place
}

/**
 * Validates and parses sold count
 */
export function validateAndParseSold(sold?: string | number | null): number {
  if (sold === null || sold === undefined || sold === '') {
    return 0;
  }

  const soldStr = sold.toString().replace(/[^\d]/g, '');
  const parsedSold = parseInt(soldStr);

  if (isNaN(parsedSold)) {
    return 0;
  }

  if (parsedSold < 0) {
    return 0;
  }

  return parsedSold;
}

/**
 * Validates complete ProductData object
 */
export function validateProductData(product: ProductData): ProductData {
  try {
    const validatedProduct: ProductData = {
      url: validateAndSanitizeUrl(product.url),
      name: sanitizeProductName(product.name),
      price: validateAndParsePrice(product.price).toString(),
      imageUrl: validateAndSanitizeImageUrl(product.imageUrl),
      rating: validateAndParseRating(product.rating),
      sold: validateAndParseSold(product.sold)
    };

    return validatedProduct;
  } catch (error) {
    throw new Error(`Product validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}