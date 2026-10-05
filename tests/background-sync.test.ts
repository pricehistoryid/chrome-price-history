import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYNC_QUEUE_KEY } from '../shared/sync-queue';

type MessageListener = (
  message: any,
  sender: unknown,
  sendResponse: (response: any) => void,
) => unknown;

interface WorkerHarness {
  send: (payload: unknown) => Promise<any>;
  navigate: (url?: string) => void;
  sentMessages: () => unknown[][];
  postedBodies: () => Array<Array<{ url: string }>>;
  storedQueue: () => unknown;
}

function product(url: string) {
  return { url, name: 'Product', image_url: '', price: 1000, rating: 0, sold: 0 };
}

/**
 * Loads the real service worker with just enough chrome surface to drive it.
 * `queueOnDisk` is what every `storage.local.get` returns for the retry queue.
 */
async function loadWorker(
  fetchImpl: () => Promise<unknown>,
  queueOnDisk: unknown = undefined,
): Promise<WorkerHarness> {
  vi.resetModules();

  let listener: MessageListener | undefined;
  const tabListeners: Array<(tabId: number, changeInfo: { url?: string }, tab: unknown) => void> = [];
  let queue = queueOnDisk;
  const sendMessageMock = vi.fn(async () => undefined);

  (global as any).defineBackground = (fn: () => void) => fn();
  (global as any).chrome = {
    runtime: {
      onMessage: {
        addListener: (fn: MessageListener) => {
          listener = fn;
        },
      },
    },
    tabs: {
      onUpdated: {
        addListener: (fn: (tabId: number, changeInfo: { url?: string }, tab: unknown) => void) => {
          tabListeners.push(fn);
        },
      },
      sendMessage: sendMessageMock,
    },
    storage: {
      local: {
        get: vi.fn(async () => ({ [SYNC_QUEUE_KEY]: queue })),
        set: vi.fn(async (items: Record<string, unknown>) => {
          queue = items[SYNC_QUEUE_KEY];
        }),
      },
    },
  };

  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    await fetchImpl();
    return { ok: true, text: async () => JSON.stringify(body) } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchMock);

  // Dynamic on purpose: each test needs the worker re-evaluated against the
  // chrome surface stubbed above, which a static import would evaluate once.
  await import('../entrypoints/background');

  return {
    send: (payload: unknown) =>
      new Promise((resolve) => {
        listener?.({ type: 'UPDATE_PRODUCT_PRICE', payload }, {}, resolve);
        void vi.advanceTimersByTimeAsync(60_000);
      }),
    navigate: (url?: string) => {
      for (const fn of tabListeners) fn(7, { url }, {});
    },
    sentMessages: () => sendMessageMock.mock.calls as unknown[][],
    postedBodies: () =>
      fetchMock.mock.calls.map((call) => JSON.parse(String((call[1] as RequestInit).body))),
    storedQueue: () => queue,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('VITE_API_JWT_TOKEN', 'test-token');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('background navigation notifications', () => {
  it('tells the content script to re-scrape on both marketplaces', async () => {
    const worker = await loadWorker(async () => undefined);

    worker.navigate('https://shopee.co.id/Uji-Monitor-i.1.2');
    worker.navigate('https://www.tokopedia.com/shop-a/sepatu-abc123');

    expect(worker.sentMessages()).toEqual([
      [7, { type: 'urlChanged' }],
      [7, { type: 'urlChanged' }],
    ]);
  });

  it('stays quiet for unsupported sites and for a missing url', async () => {
    const worker = await loadWorker(async () => undefined);

    worker.navigate('https://example.com/shop-a/sepatu-abc123');
    worker.navigate('https://tokopedia.com.evil.com/x-y1');
    worker.navigate();

    expect(worker.sentMessages()).toEqual([]);
  });
});

describe('background price upload', () => {
  it('queues the batch when the API rejects it', async () => {
    const worker = await loadWorker(async () => {
      throw new Error('network down');
    });

    const response = await worker.send([product('a')]);

    expect(response.success).toBe(false);
    expect(worker.storedQueue()).toEqual([product('a')]);
  });

  it('stops draining at the first failed request and keeps the rest', async () => {
    const queued = Array.from({ length: 101 }, (_, i) => product(`url-${i}`));
    let attempt = 0;
    const worker = await loadWorker(async () => {
      attempt += 1;
      // The trigger batch lands, then the API goes down mid-drain.
      if (attempt > 1) throw new Error('network down');
    }, queued);

    await worker.send([product('trigger')]);

    const posted = worker.postedBodies();
    expect(posted[0]).toEqual([product('trigger')]);
    // The second queued batch (the last price on its own) is never attempted.
    expect(posted.some((body) => body.length === 1 && body[0].url === 'url-100')).toBe(false);
    // Everything that was queued stays queued.
    expect(worker.storedQueue()).toEqual(queued);
  });

  it('hands over the backlog once an upload succeeds', async () => {
    const queued = [product('old-1'), product('old-2')];
    const worker = await loadWorker(async () => undefined, queued);

    const response = await worker.send([product('fresh')]);

    expect(response.success).toBe(true);
    expect(worker.postedBodies()).toEqual([[product('fresh')], queued]);
    expect(worker.storedQueue()).toEqual([]);
  });
});
