import { ProductData } from './scraper/result';
import { validateProductData } from './utils/validation';

/**
 * Retries a function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = initialDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      console.warn(`Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms...`);
    }
  }

  throw new Error('Max retries exceeded');
}

/**
 * Updates product price on the server with validation and error handling
 */
export async function updateProductPrice(productData: ProductData): Promise<void> {
  try {
    // Validate and sanitize input data
    const validatedProduct = validateProductData(productData);

    const apiUrl = import.meta.env.VITE_API_URL || 'https://pricehistory.id/api/v1/price';
    const jwtToken = import.meta.env.VITE_API_JWT_TOKEN;

    if (!jwtToken) {
      throw new Error('API JWT token is missing. Please check your environment variables.');
    }

    const headers = new Headers({
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'PriceHistory-ID-Extension/1.0.0'
    });

    const requestBody = {
      url: validatedProduct.url,
      name: validatedProduct.name,
      image_url: validatedProduct.imageUrl || '',
      price: parseInt(validatedProduct.value),
      rating: validatedProduct.rating || 0,
      sold: validatedProduct.sold || 0
    };

    const requestOptions: RequestInit = {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    };

    // Perform request with retry logic
    const response = await retryWithBackoff(async () => {
      const res = await fetch(apiUrl, requestOptions);

      if (!res.ok) {
        // Handle different HTTP status codes
        switch (res.status) {
          case 400:
            throw new Error('Bad Request: Invalid data format');
          case 401:
            throw new Error('Unauthorized: Invalid or expired token');
          case 403:
            throw new Error('Forbidden: Insufficient permissions');
          case 404:
            throw new Error('API endpoint not found');
          case 429:
            throw new Error('Too many requests: Rate limit exceeded');
          case 500:
            throw new Error('Internal server error');
          default:
            throw new Error(`HTTP error! status: ${res.status}`);
        }
      }

      return res;
    });

    const result = await response.text();
    console.log('Price updated successfully:', result);

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

    // Re-throw for caller to handle
    throw new Error(`Failed to update product price: ${errorMessage}`);
  }
}