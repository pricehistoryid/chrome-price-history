import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scrapeBlibliPDP, watchBlibliPrice } from '../entrypoints/content/v3/scraper/blibli/pdp';
import { validateProductData } from '../entrypoints/content/v3/utils/validation';

/**
 * Built to the shape of a captured Blibli product page: JSON-LD for identity
 * and a *promo* range, with the buyer's price only in the DOM. Values are
 * invented; the captured page stays out of the repository.
 */

const PRODUCT_URL = 'https://www.blibli.com/p/uji-produk-30-sachet/ps--UJI-1-0';

const ldProduct = {
  '@type': 'Product',
  name: 'Uji Produk 30 Sachet dengan Creatine',
  image: 'https://www.static-src.com/wcsstore/Indraprastha/images/catalog/thumbnail/catalog-image/UJI-1/uji_full01.jpg',
  offers: { '@type': 'AggregateOffer', lowPrice: 200000, highPrice: 292600, priceCurrency: 'IDR' },
  aggregateRating: { '@type': 'AggregateRating', ratingValue: 4, ratingCount: 23 },
};

function install({
  price = 'Rp185.000',
  sold = 'Terjual 139',
  head = `<script type="application/ld+json">${JSON.stringify(ldProduct)}</script>`,
}: { price?: string; sold?: string; head?: string } = {}) {
  document.head.innerHTML = head + '<meta property="og:image" content="https://www.static-src.com/wcsstore/Indraprastha/images/catalog/full/catalog-image/UJI-1/uji_full01.jpg">';
  document.body.innerHTML = `
    <div class="product-price">
      <div class="final-price"><span data-testid="priceComponentOffered">${price}</span></div>
    </div>
    <div class="sold-seen-label"><span>${sold}</span></div>`;
}

beforeEach(() => {
  vi.restoreAllMocks();
  install();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('scrapeBlibliPDP', () => {
  it('records the price the page offers, not the JSON-LD promo range', async () => {
    const result = await scrapeBlibliPDP(PRODUCT_URL);

    expect(result).toEqual({
      url: PRODUCT_URL,
      name: 'Uji Produk 30 Sachet dengan Creatine',
      price: 185000,
      imageUrl: 'https://www.static-src.com/wcsstore/Indraprastha/images/catalog/full/catalog-image/UJI-1/uji_full01.jpg',
      rating: 4,
      sold: '139',
    });
  });

  it('falls back to the JSON-LD offer when the price element is missing', async () => {
    document.body.innerHTML = '<div class="sold-seen-label"><span>Terjual 3</span></div>';

    const result = await scrapeBlibliPDP(PRODUCT_URL);

    expect(result?.price).toBe(200000);
  });

  it('reports no data rather than guessing when the product block is absent', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers();
    install({ head: '' });

    const pending = scrapeBlibliPDP(PRODUCT_URL, { timeoutMs: 300 });
    await vi.advanceTimersByTimeAsync(400);

    await expect(pending).resolves.toBeNull();
  });

  it('reports no data when there is no price to record', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    install({
      price: '',
      head: `<script type="application/ld+json">${JSON.stringify({ ...ldProduct, offers: {} })}</script>`,
    });

    await expect(scrapeBlibliPDP(PRODUCT_URL)).resolves.toBeNull();
  });

  it('produces a payload the upload path accepts', async () => {
    const result = await scrapeBlibliPDP(PRODUCT_URL);

    expect(() => validateProductData(result!)).not.toThrow();
  });
});

describe('watchBlibliPrice', () => {
  function setPrice(text: string) {
    document.querySelector('[data-testid="priceComponentOffered"]')!.textContent = text;
  }

  it('reports a variant selection, which changes no URL', async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();

    const dispose = watchBlibliPrice(onChange, { debounceMs: 100 });
    setPrice('Rp200.000');
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(200);

    expect(onChange).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('does nothing when the price region is not on the page', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    const onChange = vi.fn();

    const dispose = watchBlibliPrice(onChange, { debounceMs: 100 });
    await vi.advanceTimersByTimeAsync(200);

    expect(onChange).not.toHaveBeenCalled();
    dispose();
  });
});

describe('scrapeBlibliPDP image', () => {
  const BANNER = 'https://www.static-src.com/siva/asset/09_2023/homepage_fb_rebranding.jpg';
  const CATALOG_THUMB = 'https://www.static-src.com/wcsstore/Indraprastha/images/catalog/thumbnail/catalog-image/UJI-1/uji_full01.jpg';
  const CATALOG_FULL = CATALOG_THUMB.replace('/thumbnail/', '/full/');

  it('ignores the site banner the page falls back to, and upgrades the thumbnail', async () => {
    install({
      price: 'Rp185.000',
      head: `<script type="application/ld+json">${JSON.stringify(ldProduct)}</script>`
        + `<meta property="og:image" content="${BANNER}">`,
    });

    const result = await scrapeBlibliPDP(PRODUCT_URL);

    expect(result?.imageUrl).toBe(CATALOG_FULL);
  });

  it('stores no image rather than site art when only the banner is offered', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    install({
      price: 'Rp185.000',
      head: `<script type="application/ld+json">${JSON.stringify({ ...ldProduct, image: undefined })}</script>`
        + `<meta property="og:image" content="${BANNER}">`,
    });

    const result = await scrapeBlibliPDP(PRODUCT_URL);

    expect(result?.imageUrl).toBe('');
  });
});
