import { describe, expect, it } from 'vitest';
import { productPageUrl } from '../shared/pricehistory-url';

// Expected values are copied from pricehistory.id's sitemap (archived captures),
// so a change to the slug rule fails here rather than producing dead links.
describe('productPageUrl', () => {
  it('turns a tokopedia product URL into the app route', () => {
    expect(
      productPageUrl(
        'https://www.tokopedia.com/nykcomputerofficial/usb-hub-3-0-nyk-7-port-cable-1m-otg-type-c',
      ),
    ).toBe(
      'https://pricehistory.id/product/www-tokopedia-com-nykcomputerofficial-usb-hub-3-0-nyk-7-port-cable-1m-otg-type-c',
    );
  });

  it('keeps digits and existing dashes intact', () => {
    expect(
      productPageUrl(
        'https://www.tokopedia.com/electronicgadgetofficial/anker-charger-735-nano-gan-2-65w-45w-3-port-usb-type-a-c-pd-pps-a2667',
      ),
    ).toBe(
      'https://pricehistory.id/product/www-tokopedia-com-electronicgadgetofficial-anker-charger-735-nano-gan-2-65w-45w-3-port-usb-type-a-c-pd-pps-a2667',
    );
  });

  it('ignores a trailing slash instead of emitting a trailing dash', () => {
    expect(productPageUrl('https://www.tokopedia.com/shop-a/sepatu-abc123/')).toBe(
      'https://pricehistory.id/product/www-tokopedia-com-shop-a-sepatu-abc123',
    );
  });

  it('builds a route for a product key that has no scheme', () => {
    expect(productPageUrl('www.tokopedia.com/shop-a/sepatu-abc123')).toBe(
      'https://pricehistory.id/product/www-tokopedia-com-shop-a-sepatu-abc123',
    );
  });
});
