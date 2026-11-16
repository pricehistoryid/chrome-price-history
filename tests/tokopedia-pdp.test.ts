import fixture from '../fixtures/tokopedia/pdp-adata.html?raw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { scrapePDP } from '../entrypoints/content/v3/scraper/tokopedia/pdp';
import { updateProductPrice } from '../entrypoints/content/v3/api';

const PRODUCT_URL = 'https://www.tokopedia.com/dmg1/adata-xpg-kyber-ii-atx-3-1-power-supply-650w-80-gold-semi-modular-black-1734137354203071728';
const sendMessage = vi.fn(async () => ({ success: true }));

beforeEach(() => {
  document.documentElement.innerHTML = fixture.slice(fixture.indexOf('<head>'), fixture.indexOf('</html>'));
  vi.stubGlobal('chrome', { runtime: { sendMessage } });
  sendMessage.mockClear();
});

describe('Tokopedia product page price', () => {
  it('uploads the page-declared price when the visible price has not rendered', async () => {
    document.querySelector('[data-testid="lblPDPDetailProductPrice"]')?.remove();
    const product = await scrapePDP(PRODUCT_URL);
    expect(product?.price).toBe('1065000');

    await updateProductPrice(product!);
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'UPDATE_PRODUCT_PRICE',
      payload: [expect.objectContaining({ url: PRODUCT_URL, price: 1065000 })],
    }));
  });

  it('prefers the displayed price when it differs from page metadata', async () => {
    document.querySelector('meta[property="product:price:amount"]')?.setAttribute('content', '999000');
    expect((await scrapePDP(PRODUCT_URL))?.price).toBe('1065000');
  });

  it('does not upload when neither the DOM nor metadata has a price', async () => {
    document.querySelector('[data-testid="lblPDPDetailProductPrice"]')?.remove();
    document.querySelector('meta[property="product:price:amount"]')?.remove();
    const product = await scrapePDP(PRODUCT_URL);
    expect(product).toBeNull();
    if (product) await updateProductPrice(product);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
