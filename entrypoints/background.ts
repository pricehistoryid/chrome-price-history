import { classifyPage } from '../shared/page-url';
import {
  ACCOUNT_SYNC_REJECTED_KEY,
  ACCOUNT_SYNC_QUEUE_KEY,
  batchForUpload,
  mergeIntoQueue,
  readQueue,
  type QueuedPrice
} from '../shared/sync-queue';

export default defineBackground(() => {
  // Serialize account queue updates so concurrent content scripts cannot lose observations.
  let uploads: Promise<void> = Promise.resolve();
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'UPDATE_PRODUCT_PRICE') {
      const prior = uploads;
      const boundAccount = accountId().catch((error: unknown) => error instanceof Error ? error : new Error('Session check failed'));
      const next = prior.then(() => boundAccount).then((id) => {
        if (id instanceof Error) throw id;
        return handleUpdateProductPrice(message.payload, id);
      });
      uploads = next.then(() => undefined, () => undefined);
      void next.then(
        (result) => sendResponse({ success: true, data: result }),
        (error) => sendResponse({ success: false, error: error instanceof Error ? error.message : 'Sync failed' }),
      );
      return true;
    }
    if (message.type === 'GET_PRODUCT_PRICE_HISTORY') {
      void readProductPriceHistory(message.url)
        .then((result) => sendResponse({ success: true, ...result }))
        .catch(() => sendResponse({ success: false, accountId: null, data: [] }));
      return true;
    }
    if (message.type === 'GET_SYNC_STATUS') {
      void getSyncStatus()
        .then((status) => sendResponse({ success: true, ...status }))
        .catch(() => sendResponse({ success: false, authenticated: false, accountId: null, pending: 0 }));
      return true;
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

/** Website sessions are the only extension sync credential. */
function apiUrl(): URL {
  const configured = import.meta.env.VITE_API_URL;
  if (!configured) throw new Error('VITE_API_URL is missing; see .env.example.');
  const url = new URL(configured);
  if (!url.pathname.endsWith('/account/prices')) throw new Error('Account price endpoint is not configured.');
  return url;
}

async function accountId(): Promise<string | null> {
  const url = apiUrl();
  url.pathname = url.pathname.replace(/\/account\/prices$/, '/auth/me');
  const response = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Session check failed: ${response.status}`);
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !('data' in body) || !body.data || typeof body.data !== 'object' || !('id' in body.data) || typeof body.data.id !== 'string') {
    throw new Error('Invalid session response');
  }
  return body.data.id;
}

function accountQueues(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function getSyncStatus() {
  const id = await accountId();
  if (!id) return { authenticated: false, accountId: null, pending: 0, rejected: 0 };
  const stored = await chrome.storage.local.get([ACCOUNT_SYNC_QUEUE_KEY, ACCOUNT_SYNC_REJECTED_KEY]);
  const rejected = accountQueues(stored[ACCOUNT_SYNC_REJECTED_KEY])[id];
  return {
    authenticated: true, accountId: id,
    pending: readQueue(accountQueues(stored[ACCOUNT_SYNC_QUEUE_KEY])[id]).length,
    rejected: Array.isArray(rejected) ? rejected.length : 0,
  };
}

async function handleUpdateProductPrice(payload: unknown, id: string | null): Promise<string> {
  if (!id) return 'local-only';
  const batch = readQueue(payload).filter((item) => item.observed_at !== undefined && item.price <= 2_147_483_647);
  if (batch.length === 0) return 'local-only';
  await enqueuePrices(id, batch);
  if (!await drainQueue(id)) throw new Error('Prices remain queued for this account');
  return 'sent';
}

async function postPrices(batch: QueuedPrice[], id: string): Promise<string> {
  const request: RequestInit = {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-PriceHistory-Account': id, 'Content-Type': 'application/json' },
    body: JSON.stringify(batch.map(({ url, price, observed_at }) => ({ url, price, observed_at }))),
  };
  const response = await fetch(apiUrl(), request);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403 || response.status === 400) throw new SyncRejected(response.status);
    throw new Error(`Price sync failed: ${response.status}`);
  }
  return response.text();
}

class SyncRejected extends Error {
  constructor(public status: number) { super(`Price sync rejected: ${status}`); }
}

async function readProductPriceHistory(url: unknown): Promise<{ accountId: string | null; data: Array<{ time: string; price: number }> }> {
  if (typeof url !== 'string' || url.length === 0) return { accountId: null, data: [] };
  const id = await accountId();
  if (!id) return { accountId: null, data: [] };
  const endpoint = apiUrl();
  endpoint.searchParams.set('url', url);
  const response = await fetch(endpoint, {
    method: 'GET', credentials: 'include',
    headers: { 'X-PriceHistory-Account': id, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Price history read failed: ${response.status}`);
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !('success' in body) || body.success !== true || !('data' in body) || !Array.isArray(body.data)) {
    throw new Error('Invalid price history response.');
  }
  const data = body.data.filter((point: unknown): point is { time: string; price: number } => {
    if (!point || typeof point !== 'object' || !('time' in point) || !('price' in point)) return false;
    return typeof point.time === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(point.time) &&
      typeof point.price === 'number' && Number.isInteger(point.price) && point.price >= 0;
  });
  return await accountId() === id ? { accountId: id, data } : { accountId: null, data: [] };
}

async function enqueuePrices(id: string, payload: QueuedPrice[]): Promise<void> {
  const stored = await chrome.storage.local.get(ACCOUNT_SYNC_QUEUE_KEY);
  const queues = accountQueues(stored[ACCOUNT_SYNC_QUEUE_KEY]);
  await chrome.storage.local.set({ [ACCOUNT_SYNC_QUEUE_KEY]: { ...queues, [id]: mergeIntoQueue(queues[id], payload) } });
}

async function drainQueue(id: string): Promise<boolean> {
  const stored = await chrome.storage.local.get([ACCOUNT_SYNC_QUEUE_KEY, ACCOUNT_SYNC_REJECTED_KEY]);
  const queues = accountQueues(stored[ACCOUNT_SYNC_QUEUE_KEY]);
  const rejected = accountQueues(stored[ACCOUNT_SYNC_REJECTED_KEY]);
  const queue = readQueue(queues[id]).filter((item) => item.observed_at !== undefined);
  if (queue.length === 0) return true;
  const remaining: QueuedPrice[] = [];
  const permanent: QueuedPrice[] = [];
  let reachable = true;
  for (const batch of batchForUpload(queue)) {
    if (!reachable) { remaining.push(...batch); continue; }
    try {
      await postPrices(batch, id);
    } catch (error) {
      if (error instanceof SyncRejected && error.status === 400 && batch.length > 1) {
        for (const item of batch) {
          if (!reachable) { remaining.push(item); continue; }
          try {
            await postPrices([item], id);
          } catch (itemError) {
            if (itemError instanceof SyncRejected && itemError.status === 400) permanent.push(item);
            else { remaining.push(item); reachable = false; }
          }
        }
      } else if (error instanceof SyncRejected && error.status === 400) {
        permanent.push(...batch);
      } else {
        remaining.push(...batch);
        reachable = false;
      }
    }
  }
  await chrome.storage.local.set({
    [ACCOUNT_SYNC_QUEUE_KEY]: { ...queues, [id]: remaining },
    [ACCOUNT_SYNC_REJECTED_KEY]: { ...rejected, [id]: mergeIntoQueue(rejected[id], permanent) },
  });
  return remaining.length === 0 && permanent.length === 0;
}
