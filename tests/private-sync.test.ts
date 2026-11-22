import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SYNC_QUEUE_KEY } from '../shared/sync-queue';

type RequestMessage = { type: string; payload?: unknown; url?: string };
type Reply = { success?: boolean; authenticated?: boolean; accountId?: string | null; pending?: number; data?: unknown };
type Listener = (message: RequestMessage, sender: unknown, respond: (value: Reply) => void) => boolean | void;

const price = { url: 'https://www.tokopedia.com/shop/sepatu-123', name: 'Sepatu', image_url: '', price: 100000, rating: 0, sold: 0, observed_at: '2026-11-18' };
const legacy = { ...price, url: 'https://www.tokopedia.com/old/item-123' };

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('VITE_API_URL', 'http://localhost:9999/api/v1/account/prices');
  vi.stubEnv('VITE_API_JWT_TOKEN', 'must-not-appear');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function worker(session: string | null, uploadStatus = 200, holdRead = false, accountQueue?: unknown, rejectedUrl?: string, holdUpload = false, failSecondProbe = false) {
  vi.resetModules();
  let listener: Listener | undefined;
  let currentSession = session;
  let currentUploadStatus = uploadStatus;
  const readGate = Promise.withResolvers<void>();
  const uploadGate = Promise.withResolvers<void>();
  let uploadCount = 0;
  let probes = 0;
  const stored: Record<string, unknown> = { [SYNC_QUEUE_KEY]: [legacy], ...(accountQueue ? { account_sync_queue: accountQueue } : {}) };
  const fetches: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal('defineBackground', (run: () => void) => run());
  vi.stubGlobal('chrome', {
    runtime: { onMessage: { addListener: (fn: Listener) => { listener = fn; } } },
    tabs: { onUpdated: { addListener: () => {} }, sendMessage: vi.fn(async () => undefined) },
    storage: { local: {
      get: vi.fn(async () => ({ ...stored })),
      set: vi.fn(async (items: Record<string, unknown>) => { Object.assign(stored, items); }),
    } },
  });
  vi.stubGlobal('fetch', vi.fn(async (target: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(target);
    fetches.push({ url, init });
    if (url.endsWith('/auth/me')) {
      if (failSecondProbe && ++probes === 2) throw new Error('auth probe failed');
      return { ok: !!currentSession, status: currentSession ? 200 : 401, json: async () => ({ success: true, data: { id: currentSession } }) };
    }
    if (init.method === 'GET') {
      if (holdRead) await readGate.promise;
      return { ok: true, status: 200, json: async () => ({ success: true, data: [{ time: '2026-11-17', price: 120000 }] }) };
    }
    const status = rejectedUrl && JSON.parse(String(init.body)).some((item: { url: string }) => item.url === rejectedUrl) ? 400 : currentUploadStatus;
    if (holdUpload && ++uploadCount === 1) await uploadGate.promise;
    return { ok: status === 200, status, text: async () => 'ok' };
  }));
  // The worker is evaluated after chrome and fetch are stubbed, exactly as MV3 starts it.
  await import('../entrypoints/background');
  const send = (message: RequestMessage): Promise<Reply> => {
    const { promise, resolve } = Promise.withResolvers<Reply>();
    const handled = listener?.(message, {}, resolve);
    if (!handled) resolve({});
    return promise;
  };
  return { send, fetches, stored, finishRead: readGate.resolve, finishUpload: uploadGate.resolve, setSession: (value: string | null) => { currentSession = value; }, setUploadStatus: (value: number) => { currentUploadStatus = value; } };
}

it('keeps signed-out observations local and never uploads the legacy unowned queue', async () => {
  const { send, fetches, stored } = await worker(null);
  expect(await send({ type: 'GET_SYNC_STATUS' })).toMatchObject({ authenticated: false, accountId: null });
  expect(await send({ type: 'UPDATE_PRODUCT_PRICE', payload: [price] })).toMatchObject({ success: true });
  expect(await send({ type: 'GET_PRODUCT_PRICE_HISTORY', url: price.url })).toMatchObject({ data: [] });
  expect(fetches.every(({ url }) => url.endsWith('/auth/me'))).toBe(true);
  expect(stored[SYNC_QUEUE_KEY]).toEqual([legacy]);
  expect(stored.account_sync_queue).toBeUndefined();
});

it('uses the website session and account identity for private uploads and reads', async () => {
  const { send, fetches, stored } = await worker('account-a');
  expect(await send({ type: 'UPDATE_PRODUCT_PRICE', payload: [price] })).toMatchObject({ success: true });
  expect(await send({ type: 'GET_PRODUCT_PRICE_HISTORY', url: price.url })).toMatchObject({ success: true, accountId: 'account-a', data: [{ time: '2026-11-17', price: 120000 }] });
  const requests = fetches.filter(({ url }) => url.includes('/account/prices'));
  expect(requests.map(({ init }) => init.method)).toEqual(['POST', 'GET']);
  for (const { init } of requests) {
    expect(init.credentials).toBe('include');
    expect(new Headers(init.headers).get('X-PriceHistory-Account')).toBe('account-a');
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
  }
  expect(stored[SYNC_QUEUE_KEY]).toEqual([legacy]);
});

it('drops private history when the website account changes during the read', async () => {
  const { send, fetches, setSession, finishRead } = await worker('account-a', 200, true);
  const pending = send({ type: 'GET_PRODUCT_PRICE_HISTORY', url: price.url });
  await vi.waitFor(() => expect(fetches.some(({ url }) => url.includes('/account/prices'))).toBe(true));
  setSession('account-b');
  finishRead();
  expect(await pending).toMatchObject({ accountId: null, data: [] });
});

it('keeps a failed upload under its own account and does not send it after account switch', async () => {
  const { send, fetches, stored, setSession, setUploadStatus } = await worker('account-a', 403);
  expect(await send({ type: 'UPDATE_PRODUCT_PRICE', payload: [price] })).toMatchObject({ success: false });
  expect(stored.account_sync_queue).toMatchObject({ 'account-a': [price] });
  setSession('account-b');
  setUploadStatus(200);
  expect(await send({ type: 'UPDATE_PRODUCT_PRICE', payload: [{ ...price, url: 'https://www.tokopedia.com/shop/new-123' }] })).toMatchObject({ success: true });
  expect(await send({ type: 'GET_SYNC_STATUS' })).toMatchObject({ authenticated: true, accountId: 'account-b', pending: 0 });
  expect(stored.account_sync_queue).toMatchObject({ 'account-a': [price] });
  expect(stored[SYNC_QUEUE_KEY]).toEqual([legacy]);
  const posts = fetches.filter(({ init }) => init.method === 'POST');
  expect(posts).toHaveLength(2);
  expect(new Headers(posts[1].init.headers).get('X-PriceHistory-Account')).toBe('account-b');
  setSession('account-a');
  expect(await send({ type: 'GET_SYNC_STATUS' })).toMatchObject({ authenticated: true, accountId: 'account-a', pending: 1 });
  expect(await send({ type: 'UPDATE_PRODUCT_PRICE', payload: [{ ...price, url: 'https://www.tokopedia.com/shop/another-123' }] })).toMatchObject({ success: true });
  expect(stored.account_sync_queue).toMatchObject({ 'account-a': [] });
  expect(fetches.filter(({ init }) => init.method === 'POST')).toHaveLength(3);
});

it('binds a second observation to its account before an earlier upload finishes', async () => {
  const { send, fetches, setSession, finishUpload } = await worker('account-a', 200, false, undefined, undefined, true);
  const first = send({ type: 'UPDATE_PRODUCT_PRICE', payload: [price] });
  await vi.waitFor(() => expect(fetches.filter(({ init }) => init.method === 'POST')).toHaveLength(1));
  const second = send({ type: 'UPDATE_PRODUCT_PRICE', payload: [{ ...price, url: 'https://www.tokopedia.com/shop/second-123' }] });
  await vi.waitFor(() => expect(fetches.filter(({ url }) => url.endsWith('/auth/me'))).toHaveLength(2));
  setSession('account-b');
  finishUpload();
  await Promise.all([first, second]);
  const posts = fetches.filter(({ init }) => init.method === 'POST');
  expect(posts).toHaveLength(2);
  expect(new Headers(posts[1].init.headers).get('X-PriceHistory-Account')).toBe('account-a');
});

it('keeps later uploads serialized when an intervening account probe fails', async () => {
  const { send, fetches, finishUpload } = await worker('account-a', 200, false, undefined, undefined, true, true);
  const first = send({ type: 'UPDATE_PRODUCT_PRICE', payload: [price] });
  await vi.waitFor(() => expect(fetches.filter(({ init }) => init.method === 'POST')).toHaveLength(1));
  const second = send({ type: 'UPDATE_PRODUCT_PRICE', payload: [{ ...price, url: 'https://www.tokopedia.com/shop/second-123' }] });
  let secondSettled = false;
  void second.then(() => { secondSettled = true; });
  const third = send({ type: 'UPDATE_PRODUCT_PRICE', payload: [{ ...price, url: 'https://www.tokopedia.com/shop/third-123' }] });
  await vi.waitFor(() => expect(fetches.filter(({ url }) => url.endsWith('/auth/me'))).toHaveLength(3));
  await vi.advanceTimersByTimeAsync(0);
  expect(secondSettled).toBe(false);
  expect(fetches.filter(({ init }) => init.method === 'POST')).toHaveLength(1);
  finishUpload();
  expect(await second).toMatchObject({ success: false });
  expect(await third).toMatchObject({ success: true });
  await first;
});
it('sends the newest same-day price instead of replaying an older queued one', async () => {
  const { send, fetches, stored } = await worker('account-a', 200, false, { 'account-a': [{ ...price, price: 90000 }] });
  expect(await send({ type: 'UPDATE_PRODUCT_PRICE', payload: [{ ...price, price: 120000 }] })).toMatchObject({ success: true });
  const posts = fetches.filter(({ init }) => init.method === 'POST');
  expect(posts).toHaveLength(1);
  expect(JSON.parse(String(posts[0].init.body))).toEqual([{ url: price.url, price: 120000, observed_at: price.observed_at }]);
  expect(stored.account_sync_queue).toMatchObject({ 'account-a': [] });
});

it('uploads valid observations even when one queued item is rejected', async () => {
  const rejected = { ...price, url: 'https://www.tokopedia.com/shop/rejected-123' };
  const valid = { ...price, url: 'https://www.tokopedia.com/shop/valid-123' };
  const { send, fetches, stored } = await worker('account-a', 200, false, { 'account-a': [valid, rejected] }, rejected.url);
  await send({ type: 'UPDATE_PRODUCT_PRICE', payload: [{ ...price, url: 'https://www.tokopedia.com/shop/new-123' }] });
  const sent = fetches.filter(({ init }) => init.method === 'POST');
  expect(sent.some(({ init }) => JSON.parse(String(init.body)).length === 1 && JSON.parse(String(init.body))[0].url === valid.url)).toBe(true);
  expect(stored.account_sync_queue).toMatchObject({ 'account-a': [] });
  expect(stored.account_sync_rejected).toMatchObject({ 'account-a': [rejected] });
  expect(await send({ type: 'GET_SYNC_STATUS' })).toMatchObject({ accountId: 'account-a', pending: 0, rejected: 1 });
});
