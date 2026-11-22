import { afterEach, expect, it, vi } from 'vitest';
import { createChart } from 'lightweight-charts';
import { main } from '../entrypoints/content/v3/event-listener';
import { floatingButton, modal } from '../entrypoints/content/v3/inject';

const historyRequest = vi.hoisted(() => vi.fn());
vi.mock('../shared/page-url', () => ({ classifyPage: () => ({ kind: 'pdp', marketplace: 'tokopedia' }) }));
vi.mock('../entrypoints/content/v3/scraper/tokopedia/pdp', () => ({
  scrapePDP: async () => ({ url: 'https://www.tokopedia.com/shop/sepatu-123', name: 'Sepatu', price: 100000, imageUrl: '' }),
}));
vi.mock('../entrypoints/content/v3/api', () => ({
  getProductPriceHistory: historyRequest,
  updateProductPrice: async () => {},
  updateProductPrices: async () => {},
}));
vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    addSeries: vi.fn(() => ({ setData: vi.fn(), createPriceLine: vi.fn(), priceScale: () => ({ applyOptions: vi.fn() }) })),
    applyOptions: vi.fn(), timeScale: () => ({ fitContent: vi.fn() }),
    subscribeCrosshairMove: vi.fn(), removeSeries: vi.fn(), remove: vi.fn(),
  })),
  LineSeries: 'Line', ColorType: { Solid: 'solid' }, LineStyle: { Dashed: 'dashed' },
}));

afterEach(() => {
  modal.remove();
  floatingButton.getElement().remove();
  historyRequest.mockReset();
  vi.restoreAllMocks();
});

it('keeps account A history off the chart after the product tab regains focus under account B', async () => {
  const { promise: oldHistory, resolve: finishOldHistory } = Promise.withResolvers<{
    accountId: string; prices: Array<{ time: string; price: number }>;
  }>();
  historyRequest.mockReturnValueOnce(oldHistory).mockResolvedValue({ accountId: null, prices: [] });
  const stored: Record<string, unknown> = {};
  chrome.storage.local.get = vi.fn(async () => ({ ...stored }));
  chrome.storage.local.set = vi.fn(async (items: Record<string, unknown>) => { Object.assign(stored, items); });
  chrome.runtime.onMessage = { addListener: vi.fn() } as unknown as typeof chrome.runtime.onMessage;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  document.body.innerHTML = '';
  main();

  await vi.waitFor(() => expect(floatingButton.getElement().isConnected).toBe(true));
  floatingButton.getElement().click();
  await vi.waitFor(() => expect(historyRequest).toHaveBeenCalled());
  await vi.waitFor(() => expect(modal.querySelector('#price-current')?.textContent).toMatch(/100[.,]000/));
  window.dispatchEvent(new Event('focus'));
  finishOldHistory({ accountId: 'account-a', prices: [{ time: '2026-11-17', price: 50000 }] });
  await vi.waitFor(() => expect(historyRequest).toHaveBeenCalledTimes(2));
  await Promise.resolve();
  await Promise.resolve();
  expect(modal.querySelector('#price-lowest')?.textContent).toMatch(/100[.,]000/);
  expect(createChart).toHaveBeenCalled();
});

it('removes private prices from the visible chart when the product tab loses focus', async () => {
  historyRequest.mockResolvedValue({ accountId: 'account-a', prices: [{ time: '2026-11-17', price: 50000 }] });
  const stored: Record<string, unknown> = {};
  chrome.storage.local.get = vi.fn(async () => ({ ...stored }));
  chrome.storage.local.set = vi.fn(async (items: Record<string, unknown>) => { Object.assign(stored, items); });
  chrome.runtime.onMessage = { addListener: vi.fn() } as unknown as typeof chrome.runtime.onMessage;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  document.body.innerHTML = '';
  main();
  await vi.waitFor(() => expect(floatingButton.getElement().isConnected).toBe(true));
  floatingButton.getElement().click();
  await vi.waitFor(() => expect(modal.querySelector('#price-lowest')?.textContent).toMatch(/50[.,]000/));
  window.dispatchEvent(new Event('blur'));
  expect(modal.querySelector('#price-lowest')?.textContent).toMatch(/100[.,]000/);
});
