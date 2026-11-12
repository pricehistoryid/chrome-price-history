import { describe, it, expect, vi, beforeAll } from 'vitest';
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

describe('Modal Structure', () => {
  it('shows a static Tren heading and the chart region', () => {
    const heading = modal.querySelector('h2');
    expect(heading?.textContent).toBe('Tren');
    expect(modal.querySelector('.modal-content #chart-container')).not.toBeNull();
    expect(modal.querySelector('[data-tab], .tab-pane')).toBeNull();
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
});
