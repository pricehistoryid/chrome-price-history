import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scrapeLazadaPDP, watchLazadaPrice } from '../entrypoints/content/v3/scraper/lazada/pdp';
import { validateProductData } from '../entrypoints/content/v3/utils/validation';

/**
 * Built to the shape of a captured Lazada product page: JSON-LD carries no
 * price at all, the sale price sits in the DOM beside a struck-through
 * original, and the only rating and sold figures on the page belong to the
 * store. Values are invented; the captured page stays out of the repository.
 */

const PRODUCT_URL = 'https://www.lazada.co.id/products/uji-hp-12-256-gb';

const ldProduct = {
  '@type': 'Product',
  name: 'Uji HP 12/256 GB Helio G81',
  image: ['https://filebroker-cdn.lazada.co.id/kf/first.jpg', 'https://filebroker-cdn.lazada.co.id/kf/second.jpg'],
  offers: {
    '@type': 'Offer',
    url: 'https://www.lazada.co.id/products/uji-hp-12-256-gb-i6842036581-s16185278365.html',
    availability: 'https://schema.org/InStock',
  },
};

function install({ sale = '1.845.000' }: { sale?: string } = {}) {
  document.head.innerHTML = `<script type="application/ld+json">${JSON.stringify(ldProduct)}</script>
    <meta property="og:image" content="https://img.lazcdn.com/g/ff/kf/og-image.jpg_720x720q80.jpg_.webp">`;
  document.body.innerHTML = `
    <div class="pdp-v2-product-price-content">
      <div class="pdp-v2-product-price-content-salePrice">
        <span class="pdp-v2-product-price-content-salePrice-sign">Rp</span>
        <span class="pdp-v2-product-price-content-salePrice-amount">${sale}</span>
      </div>
      <div class="pdp-v2-product-price-content-originalPrice">
        <span class="pdp-v2-product-price-content-originalPrice-amount">Rp1.899.000</span>
      </div>
    </div>
    <span class="ratings-tag selling-tag"><span class="selling-tag-text">40.2K Terjual oleh Toko</span></span>`;
}

beforeEach(() => {
  vi.restoreAllMocks();
  install();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('scrapeLazadaPDP', () => {
  it('records the sale price, not the struck-through original', async () => {
    const result = await scrapeLazadaPDP(PRODUCT_URL);

    expect(result).toEqual({
      url: PRODUCT_URL,
      name: 'Uji HP 12/256 GB Helio G81',
      price: 1845000,
      imageUrl: 'https://filebroker-cdn.lazada.co.id/kf/first.jpg',
      rating: null,
      sold: '',
    });
  });

  it('reports the store figures as unknown instead of mis-attributing them', async () => {
    const result = await scrapeLazadaPDP(PRODUCT_URL);

    // The page's only rating ("4.8/5") and sold count ("40.2K Terjual oleh
    // Toko") describe the seller, so they are not this product's numbers.
    expect(result?.rating).toBeNull();
    expect(result?.sold).toBe('');
  });

  it('reports no data rather than guessing when the price element is absent', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.innerHTML = '';

    await expect(scrapeLazadaPDP(PRODUCT_URL)).resolves.toBeNull();
  });

  it('reports no data when the product block never appears', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers();
    document.head.innerHTML = '';
    document.body.innerHTML = '';

    const pending = scrapeLazadaPDP(PRODUCT_URL, { timeoutMs: 300 });
    await vi.advanceTimersByTimeAsync(400);

    await expect(pending).resolves.toBeNull();
  });

  it('produces a payload the upload path accepts', async () => {
    const result = await scrapeLazadaPDP(PRODUCT_URL);

    expect(() => validateProductData(result!)).not.toThrow();
  });
});

describe('watchLazadaPrice', () => {
  function setSalePrice(text: string) {
    document.querySelector('.pdp-v2-product-price-content-salePrice-amount')!.textContent = text;
  }

  it('reports a variant selection, which changes the price in place', async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();

    const dispose = watchLazadaPrice(onChange, { debounceMs: 100 });
    setSalePrice('1.799.000');
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(200);

    expect(onChange).toHaveBeenCalledTimes(1);
    dispose();
  });
});

describe('scrapeLazadaPDP image', () => {
  const BADGE = 'https://img.lazcdn.com/g/tps/imgextra/i3/O1CN01kuKV6Y1WIsbGXw5h9_!!6000000002766-2-tps-48-48.png';

  it('rejects a store badge offered as the page image', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    install();
    document.head.innerHTML = `<script type="application/ld+json">${JSON.stringify({ ...ldProduct, image: BADGE })}</script>
      <meta property="og:image" content="${BADGE}">`;

    const result = await scrapeLazadaPDP(PRODUCT_URL);

    expect(result?.imageUrl).toBe('');
  });

  it('skips a badge and keeps the real photo from the other source', async () => {
    install();
    document.head.innerHTML = `<script type="application/ld+json">${JSON.stringify({ ...ldProduct, image: [BADGE] })}</script>
      <meta property="og:image" content="https://img.lazcdn.com/g/ff/kf/S80dabfe60e434bfca2c2aa1eba47af91r.jpg_720x720q80.jpg_.webp">`;

    const result = await scrapeLazadaPDP(PRODUCT_URL);

    expect(result?.imageUrl).toBe('https://img.lazcdn.com/g/ff/kf/S80dabfe60e434bfca2c2aa1eba47af91r.jpg_720x720q80.jpg_.webp');
  });
});

describe('scrapeLazadaPDP image sources', () => {
  it('finds the photo on a product block that is not the one carrying the name', async () => {
    install();
    document.head.innerHTML =
      `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: ldProduct.name })}</script>`
      + `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', image: ['https://filebroker-cdn.lazada.co.id/kf/second-block.jpg'] })}</script>`
      + '<meta property="og:image" content="https://img.lazcdn.com/g/tps/imgextra/badge-48-48.png">';

    const result = await scrapeLazadaPDP(PRODUCT_URL);

    expect(result?.imageUrl).toBe('https://filebroker-cdn.lazada.co.id/kf/second-block.jpg');
  });
});

describe('scrapeLazadaPDP image shapes', () => {
  it('resolves the protocol-relative alicdn photos from the other page shape', async () => {
    install();
    document.head.innerHTML = `<script type="application/ld+json">${JSON.stringify({
      ...ldProduct,
      image: ['//laz-img-sg.alicdn.com/p/ae1600b454cdce0ce0a1900091528dfc.jpg', '//laz-img-sg.alicdn.com/p/d78a242bb00ba75d3c881034845f9fd6.jpg'],
    })}</script>
      <meta property="og:image" content="https://img.lazcdn.com/g/p/ae1600b454cdce0ce0a1900091528dfc.jpg_720x720q80.jpg_.webp">`;

    const result = await scrapeLazadaPDP(PRODUCT_URL);

    expect(result?.imageUrl).toBe('https://laz-img-sg.alicdn.com/p/ae1600b454cdce0ce0a1900091528dfc.jpg');
  });

  it('accepts the /g/p/ CDN shape when the structured data has nothing usable', async () => {
    install();
    document.head.innerHTML = `<script type="application/ld+json">${JSON.stringify({ ...ldProduct, image: undefined })}</script>
      <meta property="og:image" content="https://img.lazcdn.com/g/p/ae1600b454cdce0ce0a1900091528dfc.jpg_720x720q80.jpg_.webp">`;

    const result = await scrapeLazadaPDP(PRODUCT_URL);

    expect(result?.imageUrl).toBe('https://img.lazcdn.com/g/p/ae1600b454cdce0ce0a1900091528dfc.jpg_720x720q80.jpg_.webp');
  });
});
