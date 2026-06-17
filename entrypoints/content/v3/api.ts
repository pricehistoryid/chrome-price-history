import { ProductData } from './scraper/result';
import { validateProductData } from './utils/validation';

/**
 * Updates product price on the server via the background service worker
 * to bypass CORS and Private Network Access restrictions.
 */
export async function updateProductPrice(productData: ProductData): Promise<void> {
  try {
    // Validate and sanitize input data in content script first
    const validatedProduct = validateProductData(productData);

    const requestBody = {
      url: validatedProduct.url,
      name: validatedProduct.name,
      image_url: validatedProduct.imageUrl || '',
      price: parseInt(validatedProduct.price.toString()),
      rating: validatedProduct.rating || 0,
      sold: validatedProduct.sold || 0
    };

    // Send message to background script to perform the actual fetch
    const response: { success: boolean; data?: any; error?: string } = await chrome.runtime.sendMessage({
      type: 'UPDATE_PRODUCT_PRICE',
      payload: requestBody
    });

    if (!response.success) {
      throw new Error(response.error || 'Unknown error occurred in background script');
    }

    // console.log('Price updated successfully via background script');

  } catch (error) {
    // Provide detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    // Log error for debugging
    console.error('Failed to update product price:', {
      error: errorMessage,
      productUrl: productData.url,
      productName: productData.name,
      timestamp: new Date().toISOString()
    });

    // ponytail: silent failure to avoid user confusion in chrome://extensions
  }
}
