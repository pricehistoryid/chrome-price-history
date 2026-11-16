import { afterEach, expect, it, vi } from 'vitest';
import { createChart } from 'lightweight-charts';
import { main } from '../entrypoints/content/v3/event-listener';
import { floatingButton, modal } from '../entrypoints/content/v3/inject';

vi.mock('../shared/page-url', () => ({
  classifyPage: () => ({ kind: 'pdp', marketplace: 'tokopedia' }),
}));
vi.mock('../entrypoints/content/v3/scraper/tokopedia/pdp', () => ({
  scrapePDP: async () => ({
    url: 'https://www.tokopedia.com/shop/sepatu-abc123',
    name: 'Sepatu harian',
    price: 120000,
    imageUrl: '',
  }),
}));
vi.mock('../entrypoints/content/v3/api', () => ({
  getProductPriceHistory: async () => { throw new Error('API unavailable'); },
  updateProductPrice: async () => {},
  updateProductPrices: async () => {},
}));
vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    addSeries: vi.fn(() => ({
      setData: vi.fn(), createPriceLine: vi.fn(),
      priceScale: () => ({ applyOptions: vi.fn() }),
    })),
    applyOptions: vi.fn(), timeScale: () => ({ fitContent: vi.fn() }),
    subscribeCrosshairMove: vi.fn(), removeSeries: vi.fn(), remove: vi.fn(),
  })),
  LineSeries: 'Line', ColorType: { Solid: 'solid' }, LineStyle: { Dashed: 'dashed' },
}));

const productUrl = 'https://www.tokopedia.com/shop/sepatu-abc123';

afterEach(() => {
  modal.remove();
  floatingButton.getElement().remove();
  vi.restoreAllMocks();
});

it('finishes loading the local chart without reopening when the API is down and the first draw fails', async () => {
  const { promise: historyRead, resolve: finishHistoryRead } = Promise.withResolvers<object>();
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.spyOn(chrome.storage.local, 'get').mockImplementation(async () => historyRead);
  vi.spyOn(chrome.storage.local, 'set').mockImplementation(async () => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.mocked(createChart).mockImplementationOnce(() => { throw new Error('Canvas not ready'); });
  chrome.runtime.onMessage = { addListener: vi.fn() } as unknown as typeof chrome.runtime.onMessage;
  document.body.innerHTML = '';
  main();

  try {
    await vi.waitFor(() => expect(floatingButton.getElement().isConnected).toBe(true));
    floatingButton.getElement().click();
    expect(modal.querySelector('.modal-content')?.getAttribute('data-loading')).toBe('true');
    expect(modal.querySelector('#price-history-status')?.textContent).toContain('Memuat');
    expect(createChart).not.toHaveBeenCalled();
    finishHistoryRead({ price_history: { [productUrl]: {
      prevPrice: [{ time: '2026-11-15', price: 150000 }],
      lowestPrice: { time: '2026-11-15', price: 150000 },
    } } });
    await vi.waitFor(() => expect(createChart).toHaveBeenCalledTimes(1));
    expect(frames).toHaveLength(1);
    expect(modal.querySelector('.modal-content')?.getAttribute('data-loading')).toBe('true');
    frames[0](0);
    await vi.waitFor(() => expect(createChart).toHaveBeenCalledTimes(2));
    expect(modal.querySelector('.modal-content')?.hasAttribute('data-loading')).toBe(false);
    expect(modal.querySelector('#price-history-summary')?.textContent).toContain('120.000');
    expect((modal.querySelector('#chart-container') as HTMLElement).hidden).toBe(false);
    expect(modal.style.display).toBe('block');
  } finally {
    finishHistoryRead({});
  }
});
