import { describe, expect, it } from 'vitest';
import { productPageUrl, productSlug } from '../shared/pricehistory-url';

/**
 * Expected values are the app's own output, not a hand-derived guess: each was
 * produced by running `generateProductSlug` from
 * `frontend-web/apps/api/src/utils/slug.ts` against the same URLs. That
 * function runs at ingest and keys both the web route and the API, so a drift
 * here is a 404 on the product page.
 */
describe('productSlug', () => {
  it('keeps the first host label and the path, for every marketplace', () => {
    expect(
      productSlug('https://www.tokopedia.com/nykcomputerofficial/usb-hub-3-0-nyk-7-port-cable-1m-otg-type-c'),
    ).toBe('tokopedia-nykcomputerofficial-usb-hub-3-0-nyk-7-port-cable-1m-otg-type-c');

    expect(
      productSlug('https://shopee.co.id/Ready-Stok-Xteink-X4-X4-Pro-Ereader-Mini-Magnetic-Siap-Langsung-Kirim-i.157198500.50559614149'),
    ).toBe('shopee-ready-stok-xteink-x4-x4-pro-ereader-mini-magnetic-siap-langsung-kirim-i-157198500-50559614149');

    expect(
      productSlug('https://www.blibli.com/p/twin-pack-l-men-isopower-stargizing-30-sachet-with-creatine-vitamin-b/ps--LMS-60022-00302'),
    ).toBe('blibli-p-twin-pack-l-men-isopower-stargizing-30-sachet-with-creatine-vitamin-b-ps-lms-60022-00302');

    expect(
      productSlug('https://www.lazada.co.id/products/uji-hp-12-256-gb-i6842036581.html'),
    ).toBe('lazada-products-uji-hp-12-256-gb-i6842036581-html');
  });

  it('drops www and the TLD, which is where the old rule differed', () => {
    expect(productSlug('https://www.tokopedia.com/shop-a/sepatu-abc123')).toBe(
      'tokopedia-shop-a-sepatu-abc123',
    );
  });

  it('trims a trailing slash instead of emitting a trailing hyphen', () => {
    expect(productSlug('https://www.tokopedia.com/shop-a/sepatu-abc123/')).toBe(
      'tokopedia-shop-a-sepatu-abc123',
    );
  });

  it('resolves a product key that has no scheme', () => {
    expect(productSlug('www.tokopedia.com/shop-a/sepatu-abc123')).toBe(
      'tokopedia-shop-a-sepatu-abc123',
    );
  });

  it('answers nothing for input that is not a URL', () => {
    expect(productSlug('not a url')).toBe('');
  });
});

describe('productPageUrl', () => {
  it('points at the app route the whole ecosystem uses', () => {
    expect(productPageUrl('https://www.tokopedia.com/shop-a/sepatu-abc123')).toBe(
      'https://pricehistory.id/product/tokopedia-shop-a-sepatu-abc123',
    );
  });

  it('builds a route for a shopee product', () => {
    expect(productPageUrl('https://shopee.co.id/Uji-Monitor-i.123456.987654321')).toBe(
      'https://pricehistory.id/product/shopee-uji-monitor-i-123456-987654321',
    );
  });
});
