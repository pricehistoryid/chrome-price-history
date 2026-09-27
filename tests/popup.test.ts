import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '../entrypoints/popup/main';

function loadPopupMarkup() {
  // `String(...)` keeps Vite's `new URL(x, import.meta.url)` asset rewrite from
  // turning this file read into an http:// URL under jsdom.
  const html = readFileSync(new URL('../entrypoints/popup/index.html', String(import.meta.url)), 'utf8');
  document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
}

function visibleState(): string | undefined {
  const states = [...document.querySelectorAll<HTMLElement>('[data-state]')];
  return states.filter(el => !el.hidden).map(el => el.dataset.state)[0];
}

function setActiveTab(url: string) {
  (global as any).chrome.tabs = { query: vi.fn(async () => [{ url }]) };
  (global as any).chrome.storage.local.get = vi.fn(async () => ({}));
}

beforeEach(() => {
  loadPopupMarkup();
  setActiveTab('https://www.tokopedia.com/');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('popup states', () => {
  it('never leaves the card on the loading state', async () => {
    setActiveTab('https://www.tokopedia.com/');
    await render();
    expect(visibleState()).not.toBe('loading');
  });

  it('reports a non-tokopedia tab', async () => {
    setActiveTab('https://example.com/');
    await render();
    expect(visibleState()).toBe('not-tokopedia');
  });

  it('reports a tokopedia page that has no price to track', async () => {
    setActiveTab('https://www.tokopedia.com/');
    await render();
    expect(visibleState()).toBe('tokopedia-other');
  });

  it('reports search and wishlist pages', async () => {
    setActiveTab('https://www.tokopedia.com/search?q=sepatu');
    await render();
    expect(visibleState()).toBe('search');

    setActiveTab('https://www.tokopedia.com/wishlist/foo-bar1');
    await render();
    expect(visibleState()).toBe('wishlist');
  });

  it('reports a product that has not been recorded yet', async () => {
    setActiveTab('https://www.tokopedia.com/shop-a/sepatu-abc123');
    await render();
    expect(visibleState()).toBe('pdp-untracked');
  });

  it('reports an unreadable tab instead of staying silent', async () => {
    (global as any).chrome.tabs = { query: vi.fn(async () => { throw new Error('no access'); }) };
    await render();
    expect(visibleState()).toBe('error');
  });

  it('reports unreadable storage', async () => {
    setActiveTab('https://www.tokopedia.com/shop-a/sepatu-abc123');
    (global as any).chrome.storage.local.get = vi.fn(async () => { throw new Error('storage down'); });
    await render();
    expect(visibleState()).toBe('error');
  });
});

const trackedRecord = {
  prevPrice: [
    { time: '2026-08-14', price: 1000000 },
    { time: '2026-08-12', price: 1120000 },
  ],
  lowestPrice: { time: '2026-08-09', price: 850000 },
};

function fieldText(name: string): string {
  const el = document.querySelector<HTMLElement>(`[data-field="${name}"]`);
  return (el?.textContent ?? '').replace(/\u00a0/g, ' ');
}

function setStoredRecord(record: unknown) {
  (global as any).chrome.storage.local.get = vi.fn(async () => ({
    price_history: { 'https://www.tokopedia.com/shop-a/sepatu-abc123': record },
  }));
}

describe('popup tracked product', () => {
  beforeEach(() => {
    setActiveTab('https://www.tokopedia.com/shop-a/sepatu-abc123');
  });

  it('renders price, lowest, delta and record count', async () => {
    setStoredRecord(trackedRecord);

    await render();

    expect(visibleState()).toBe('pdp-tracked');
    expect(fieldText('current')).toBe('Rp 1.000.000');
    expect(fieldText('lowest')).toBe('Rp 850.000');
    expect(fieldText('delta')).toBe('↓ Rp 120.000');
    expect(fieldText('records')).toBe('2 records · since 12 Aug 2026');
  });

  it('shows a rise with its own class and no minus sign', async () => {
    setStoredRecord({
      prevPrice: [
        { time: '2026-08-14', price: 1200000 },
        { time: '2026-08-12', price: 1000000 },
      ],
      lowestPrice: { time: '2026-08-12', price: 1000000 },
    });

    await render();

    expect(fieldText('delta')).toBe('↑ Rp 200.000');
    expect(document.querySelector('[data-field="delta"]')?.className).toContain('up');
  });

  it('renders no delta for a single record', async () => {
    setStoredRecord({
      prevPrice: [{ time: '2026-08-14', price: 1000000 }],
      lowestPrice: { time: '2026-08-14', price: 1000000 },
    });

    await render();

    expect(visibleState()).toBe('pdp-tracked');
    expect(document.querySelector<HTMLElement>('[data-field="delta"]')?.hidden).toBe(true);
  });

  it('renders no delta when the price is unchanged', async () => {
    setStoredRecord({
      prevPrice: [
        { time: '2026-08-14', price: 1000000 },
        { time: '2026-08-12', price: 1000000 },
      ],
      lowestPrice: { time: '2026-08-14', price: 1000000 },
    });

    await render();

    expect(visibleState()).toBe('pdp-tracked');
    expect(document.querySelector<HTMLElement>('[data-field="delta"]')?.hidden).toBe(true);
  });

  it('tolerates a legacy value-shaped record', async () => {
    setStoredRecord({
      prevPrice: [
        { time: '2026-08-14', value: '1000000' },
        { time: '2026-08-12', value: '1120000' },
      ],
      lowestPrice: { time: '2026-08-09', value: '850000' },
    });

    await render();

    expect(visibleState()).toBe('pdp-tracked');
    expect(fieldText('current')).toBe('Rp 1.000.000');
    expect(fieldText('delta')).toBe('↓ Rp 120.000');
  });
});
