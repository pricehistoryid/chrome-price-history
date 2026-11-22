import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { modal } from '../entrypoints/content/v3/inject';
import { pointFooterAtProduct, setupTabListeners } from '../entrypoints/content/v3/event-listener';

beforeAll(() => {
  const mockStorage = {
    get: vi.fn((keys, callback) => callback({})),
    set: vi.fn(),
  };
  (global as any).chrome = { storage: { local: mockStorage } };
  
  // Initialize listeners for testing
  setupTabListeners(modal as HTMLDivElement);
});

beforeEach(() => vi.stubEnv('VITE_WEB_URL', 'https://pricehistory.id'));
afterEach(() => vi.unstubAllEnvs());

describe('Modal Structure', () => {
  it('identifies the price-history chart instead of relying on context', () => {
    expect(modal.querySelector('h2')?.textContent).toBe('Riwayat harga');
    expect(modal.querySelector('.modal-content #chart-container')).not.toBeNull();
    expect(modal.querySelector('[data-tab], .tab-pane')).toBeNull();
    const prices = modal.querySelector('#price-history-summary');
    expect(prices?.tagName).toBe('DL');
    expect(Array.from(prices?.querySelectorAll('dt') ?? [], (label) => label.textContent)).toEqual(['Harga terakhir', 'Harga terendah']);
    expect(prices?.querySelectorAll('dd')).toHaveLength(2);
  });

  it('names the chart dialog and keeps its close control keyboard-operable', () => {
    expect(modal.getAttribute('role')).toBe('dialog');
    expect(modal.getAttribute('aria-modal')).toBe('true');
    expect(modal.getAttribute('aria-labelledby')).toBe(modal.querySelector('h2')?.id);
    expect(modal.querySelector('.ph-modal-close')?.tagName).toBe('BUTTON');
  });

  it('explains missing history instead of showing an empty plot', () => {
    const status = modal.querySelector('[role="status"]');
    expect(status?.textContent).toMatch(/harga|riwayat/i);
  });
});

describe('Modal Functionality', () => {
  it('should hide modal when clicking close button', () => {
    const closeBtn = modal.querySelector('.ph-modal-close') as HTMLElement;
    modal.style.display = 'block';
    
    closeBtn.click();
    expect(modal.style.display).toBe('none');
  });
});

describe('Modal handoff', () => {
  it('points the footer at the product page in the app', () => {
    pointFooterAtProduct('https://www.tokopedia.com/shop-a/sepatu-abc123');

    const link = modal.querySelector<HTMLAnchorElement>('.modal-footer a');
    expect(link?.getAttribute('href')).toBe(
      'https://pricehistory.id/product/tokopedia-shop-a-sepatu-abc123',
    );
  });

  it('opens the local product page in a dev build', () => {
    vi.stubEnv('VITE_WEB_URL', 'http://localhost:3000');
    pointFooterAtProduct('https://www.tokopedia.com/shop-a/sepatu-abc123');
    expect(modal.querySelector<HTMLAnchorElement>('.modal-footer a')?.href).toBe('http://localhost:3000/product/tokopedia-shop-a-sepatu-abc123');
  });
});
