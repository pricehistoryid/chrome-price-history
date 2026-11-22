import { afterEach, expect, it, vi } from 'vitest';

async function navigationWorker() {
  vi.resetModules();
  let onUpdated: ((tabId: number, change: { url?: string }, tab: unknown) => void) | undefined;
  const sendMessage = vi.fn(async () => undefined);
  vi.stubGlobal('defineBackground', (run: () => void) => run());
  vi.stubGlobal('chrome', {
    runtime: { onMessage: { addListener: () => {} } },
    tabs: { onUpdated: { addListener: (listener: typeof onUpdated) => { onUpdated = listener; } }, sendMessage },
  });
  // The worker registers listeners during import; the chrome surface must exist first.
  await import('../entrypoints/background');
  return { navigate: (url?: string) => onUpdated?.(7, { url }, {}), sendMessage };
}

afterEach(() => { vi.unstubAllGlobals(); });

it('re-scrapes supported marketplace tabs on navigation', async () => {
  const worker = await navigationWorker();
  worker.navigate('https://shopee.co.id/Uji-Monitor-i.1.2');
  worker.navigate('https://www.tokopedia.com/shop-a/sepatu-abc123');
  expect(worker.sendMessage.mock.calls).toEqual([
    [7, { type: 'urlChanged' }],
    [7, { type: 'urlChanged' }],
  ]);
});

it('does not notify tabs on unsupported or absent URLs', async () => {
  const worker = await navigationWorker();
  worker.navigate('https://example.com/shop-a/sepatu-abc123');
  worker.navigate('https://tokopedia.com.evil.com/x-y1');
  worker.navigate();
  expect(worker.sendMessage).not.toHaveBeenCalled();
});
