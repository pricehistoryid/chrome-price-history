import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scrapeShopeePDP } from '../entrypoints/content/v3/scraper/shopee/pdp';
import { validateProductData } from '../entrypoints/content/v3/utils/validation';

/**
 * Built to the shape of a captured Shopee product page (JSON-LD `Product` in
 * the head, a `Terjual` label in the body) with invented values. The captured
 * page stays out of the repository — see
 * docs/superpowers/specs/2026-10-05-shopee-pdp-scraper-design.md
 */

const PRODUCT_URL = 'https://shopee.co.id/Uji-Monitor-24-Inch-i.123456.987654321';

const rangedProduct = {
  '@type': 'Product',
  name: 'Uji Monitor 24 Inch - Garansi Resmi',
  image: 'https://down-id.img.susercontent.com/file/uji-monitor',
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: '1600000.00',
    highPrice: '1700000.00',
    priceCurrency: 'IDR',
  },
  aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.98', ratingCount: '66' },
};

function ldJson(value: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
}

/** The page hydrating its structured data after the first poll. */
function appendLdJson(value: unknown) {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(value);
  document.head.appendChild(script);
}

function install({ head = '', body = '' }: { head?: string; body?: string } = {}) {
  document.head.innerHTML = head;
  document.body.innerHTML = body;
}

beforeEach(() => {
  vi.restoreAllMocks();
  install();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('scrapeShopeePDP', () => {
  it('reads name, image, rating and the low end of a price range', async () => {
    install({
      head: ldJson(rangedProduct),
      body: '<div class="zrnbj5"><div><span>189</span> Terjual</div></div>',
    });

    const result = await scrapeShopeePDP(PRODUCT_URL);

    expect(result).toEqual({
      url: PRODUCT_URL,
      name: 'Uji Monitor 24 Inch - Garansi Resmi',
      price: 1600000,
      imageUrl: 'https://down-id.img.susercontent.com/file/uji-monitor',
      rating: 4.98,
      sold: '189',
    });
  });

  it('reads a single-offer price', async () => {
    install({
      head: ldJson({
        '@type': 'Product',
        name: 'Uji Monitor 24 Inch',
        image: 'https://down-id.img.susercontent.com/file/uji-monitor',
        offers: { '@type': 'Offer', price: '1555000', priceCurrency: 'IDR' },
      }),
    });

    const result = await scrapeShopeePDP(PRODUCT_URL);

    expect(result?.price).toBe(1555000);
  });

  it('picks the product block out of the other JSON-LD blocks', async () => {
    install({
      head: ldJson({ '@type': 'BreadcrumbList', itemListElement: [] })
        + '<script type="application/ld+json">{ not json at all </script>'
        + ldJson(rangedProduct),
    });

    const result = await scrapeShopeePDP(PRODUCT_URL);

    expect(result?.name).toBe('Uji Monitor 24 Inch - Garansi Resmi');
  });

  it('falls back to the og tags for name and image, and strips the site suffix', async () => {
    install({
      head: ldJson({
        '@type': 'Product',
        offers: { '@type': 'AggregateOffer', lowPrice: '99000' },
      })
        + '<meta property="og:title" content="Uji Monitor 24 Inch | Shopee Indonesia">'
        + '<meta property="og:image" content="https://down-id.img.susercontent.com/file/og-monitor">',
    });

    const result = await scrapeShopeePDP(PRODUCT_URL);

    expect(result?.name).toBe('Uji Monitor 24 Inch');
    expect(result?.imageUrl).toBe('https://down-id.img.susercontent.com/file/og-monitor');
  });

  it('reads an abbreviated sold count', async () => {
    install({
      head: ldJson(rangedProduct),
      body: '<div>1,2RB Terjual</div>',
    });

    const result = await scrapeShopeePDP(PRODUCT_URL);

    expect(result?.sold).toBe('1200');
  });

  it('waits for structured data that arrives after the initial HTML', async () => {
    vi.useFakeTimers();
    install({ body: '<div><span>189</span> Terjual</div>' });

    const pending = scrapeShopeePDP(PRODUCT_URL);

    await vi.advanceTimersByTimeAsync(200); // first poll, nothing yet
    appendLdJson(rangedProduct);            // the page hydrates
    await vi.advanceTimersByTimeAsync(200); // next poll finds it

    await expect(pending).resolves.toMatchObject({
      price: 1600000,
      name: 'Uji Monitor 24 Inch - Garansi Resmi',
    });
  });

  it('reports no data rather than guessing when the page has no product', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers();
    install({ body: '<div>Rp1.600.000 - Rp1.700.000</div>' });

    const pending = scrapeShopeePDP(PRODUCT_URL, { timeoutMs: 300 });
    await vi.advanceTimersByTimeAsync(400);

    await expect(pending).resolves.toBeNull();
  });

  it('reports no data when the product block carries no usable price', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers();
    install({ head: ldJson({ '@type': 'Product', name: 'Uji Monitor 24 Inch' }) });

    const pending = scrapeShopeePDP(PRODUCT_URL, { timeoutMs: 300 });
    await vi.advanceTimersByTimeAsync(400);

    await expect(pending).resolves.toBeNull();
  });

  it('reports no data when the product block carries no name', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    install({ head: ldJson({ '@type': 'Product', offers: { price: '1000' } }) });

    await expect(scrapeShopeePDP(PRODUCT_URL)).resolves.toBeNull();
  });

  it('produces a payload the upload path accepts', async () => {
    install({
      head: ldJson(rangedProduct),
      body: '<div><span>189</span> Terjual</div>',
    });

    const result = await scrapeShopeePDP(PRODUCT_URL);

    expect(() => validateProductData(result!)).not.toThrow();
  });
});
