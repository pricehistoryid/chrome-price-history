import { classifyPage } from '../shared/page-url';
import {
  SYNC_QUEUE_KEY,
  batchForUpload,
  mergeIntoQueue,
  readQueue,
  type QueuedPrice
} from '../shared/sync-queue';

export default defineBackground(() => {
  // Listen for messages from content scripts
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_PRODUCT_PRICE') {
      handleUpdateProductPrice(message.payload)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(async (error) => {
          // The API is unreachable; keep the prices for the next successful request
          // instead of dropping them.
          await enqueuePrices(message.payload);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        });
      return true; // Keep the message channel open for async response
    }
  });

  chrome.tabs.onUpdated.addListener(
    (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, _tab: chrome.tabs.Tab) => {
      const url = changeInfo.url;
      if (!url) return;

      // Was a hardcoded Tokopedia pattern, which meant client-side navigation
      // on any other marketplace never re-ran the scraper.
      if (classifyPage(url).kind === 'unsupported') return;

      chrome.tabs.sendMessage(tabId, { type: 'urlChanged' }).catch(err => {
        console.warn('No receiver for message:', err);
      });
    }
  );
});

/**
 * Uploads a batch, then drains anything still queued. A rejected promise means
 * nothing in `payload` was delivered.
 */
async function handleUpdateProductPrice(payload: unknown): Promise<string> {
  const batch = readQueue(payload);
  if (batch.length === 0) return '';

  const result = await postPrices(batch);
  // The API answered, so this is the moment to hand over the backlog too.
  await drainQueue();
  return result;
}

async function postPrices(batch: QueuedPrice[]): Promise<string> {
  const apiUrl = import.meta.env.VITE_API_URL;
  const jwtToken = import.meta.env.VITE_API_JWT_TOKEN;

  if (!apiUrl) {
    // No fallback on purpose: a development build must not quietly upload to
    // production. .env.development and .env.production set this per mode.
    throw new Error('VITE_API_URL is missing; see .env.example.');
  }

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
    body: JSON.stringify(batch)
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

async function enqueuePrices(payload: unknown): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(SYNC_QUEUE_KEY);
    await chrome.storage.local.set({
      [SYNC_QUEUE_KEY]: mergeIntoQueue(stored[SYNC_QUEUE_KEY], payload)
    });
  } catch (error) {
    // Storage is the last line of defence; a failure here is not worth
    // breaking the response the caller is waiting on.
    console.error('Failed to queue prices for retry:', error);
  }
}

/**
 * Sends queued prices oldest-first, stopping at the first request that fails so
 * an unreachable API is not hammered, and writes back whatever is left.
 */
async function drainQueue(): Promise<void> {
  const stored = await chrome.storage.local.get(SYNC_QUEUE_KEY);
  const queue = readQueue(stored[SYNC_QUEUE_KEY]);
  if (queue.length === 0) return;

  const remaining: QueuedPrice[] = [];
  let apiReachable = true;

  for (const batch of batchForUpload(queue)) {
    if (apiReachable) {
      try {
        await postPrices(batch);
        continue;
      } catch {
        apiReachable = false;
      }
    }
    remaining.push(...batch);
  }

  await chrome.storage.local.set({ [SYNC_QUEUE_KEY]: remaining });
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
