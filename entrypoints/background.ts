export default defineBackground(() => {
  // Listen for messages from content scripts
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_PRODUCT_PRICE') {
      handleUpdateProductPrice(message.payload)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep the message channel open for async response
    }
  });

  chrome.tabs.onUpdated.addListener(
    (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, _tab: chrome.tabs.Tab) => {
      const url = changeInfo.url;

      if (
        url &&
        /^https:\/\/.*\.tokopedia\.com\/.+/.test(url)
      ) {
        const cleanedUrl = url.replace(/^https?:\/\//, '');

        chrome.tabs.sendMessage(tabId, {
          type: 'urlChanged',
          url: cleanedUrl
        }).catch(err => {
          console.warn('No receiver for message:', err);
        });
      }
    }
  );
});

/**
 * Handles product price update by fetching the API from the background script
 */
async function handleUpdateProductPrice(payload: any): Promise<string> {
  const apiUrl = import.meta.env.VITE_API_URL || 'https://pricehistory.id/api/v1/price';
  const jwtToken = import.meta.env.VITE_API_JWT_TOKEN;

  if (!jwtToken) {
    throw new Error('API JWT token is missing in background script.');
  }

  const headers = new Headers({
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json',
    'User-Agent': 'PriceHistory-ID-Extension/1.0.0'
  });

  const requestOptions: RequestInit = {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload)
  };

  const response = await retryWithBackoff(async () => {
    const res = await fetch(apiUrl, requestOptions);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return res;
  });

  return await response.text();
}

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
      if (attempt === maxRetries) throw error;
      const delay = initialDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}
