import { expect, it, vi } from 'vitest';

vi.mock('../shared/page-url', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, classifyPage: () => ({ kind: 'search', marketplace: 'tokopedia' }) };
});
vi.mock('../entrypoints/content/v3/scraper/tokopedia/search', () => ({
  scrapeSearch: async () => [
    { url: 'https://www.tokopedia.com/shop/a-123', name: 'A', price: 100, imageUrl: '' },
    { url: 'https://www.tokopedia.com/shop/b-456', name: 'B', price: 200, imageUrl: '' },
  ],
}));

it('keeps search-page observations locally when sync is signed out', async () => {
  vi.resetModules();
  document.body.innerHTML = '';
  const saved: Record<string, unknown> = {};
  vi.stubGlobal('chrome', {
    runtime: {
      getURL: (path: string) => `chrome-extension://local/${path}`,
      sendMessage: vi.fn(async () => ({ success: true, data: 'local-only' })),
      onMessage: { addListener: vi.fn() },
    },
    storage: { local: {
      get: vi.fn(async () => ({ ...saved })),
      set: vi.fn(async (items: Record<string, unknown>) => { Object.assign(saved, items); }),
    } },
  });
  const { main } = await import('../entrypoints/content/v3/event-listener');
  main();
  await vi.waitFor(() => {
    const history = saved.price_history as Record<string, { prevPrice: Array<{ price: number }> }> | undefined;
    expect(history?.['https://www.tokopedia.com/shop/a-123']?.prevPrice[0].price).toBe(100);
    expect(history?.['https://www.tokopedia.com/shop/b-456']?.prevPrice[0].price).toBe(200);
  });
  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'UPDATE_PRODUCT_PRICE' }));
  vi.unstubAllGlobals();
});
