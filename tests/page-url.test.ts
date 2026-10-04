import { describe, expect, it } from 'vitest';
import { classifyPage } from '../shared/page-url';

describe('classifyPage — tokopedia', () => {
  it('keys a product page by origin and path, dropping the query string', () => {
    expect(classifyPage('https://www.tokopedia.com/shop-a/sepatu-abc123?search_id=xyz')).toEqual({
      kind: 'pdp',
      marketplace: 'tokopedia',
      productKey: 'https://www.tokopedia.com/shop-a/sepatu-abc123',
    });
  });

  it('keys a product page that has no query string', () => {
    expect(classifyPage('https://www.tokopedia.com/shop-a/tas-def456')).toEqual({
      kind: 'pdp',
      marketplace: 'tokopedia',
      productKey: 'https://www.tokopedia.com/shop-a/tas-def456',
    });
  });

  it('treats a wishlist path as wishlist even though it matches the product pattern', () => {
    expect(classifyPage('https://www.tokopedia.com/wishlist/foo-bar1')).toEqual({
      kind: 'wishlist',
      marketplace: 'tokopedia',
    });
  });

  it('recognizes the search page', () => {
    expect(classifyPage('https://www.tokopedia.com/search?q=sepatu')).toEqual({
      kind: 'search',
      marketplace: 'tokopedia',
    });
  });

  it('reports a non-product tokopedia page as other', () => {
    expect(classifyPage('https://www.tokopedia.com/')).toEqual({
      kind: 'other',
      marketplace: 'tokopedia',
    });
  });

  it('rejects a foreign host that merely contains the name in its path', () => {
    expect(classifyPage('https://evil.com/tokopedia.com/shop-a/sepatu-abc123')).toEqual({
      kind: 'unsupported',
      marketplace: null,
    });
  });

  it('rejects a lookalike host', () => {
    expect(classifyPage('https://tokopedia.com.evil.com/shop-a/sepatu-abc123')).toEqual({
      kind: 'unsupported',
      marketplace: null,
    });
  });
});

describe('classifyPage — shopee', () => {
  const productUrl = 'https://shopee.co.id/Uji-Monitor-24-Inch-i.123456.987654321';

  it('keys a product page by origin and path, dropping the query string', () => {
    expect(classifyPage(`${productUrl}?sp_atk=abc&smtt=0`)).toEqual({
      kind: 'pdp',
      marketplace: 'shopee',
      productKey: productUrl,
    });
  });

  it('recognizes the search page', () => {
    expect(classifyPage('https://shopee.co.id/search?keyword=monitor')).toEqual({
      kind: 'search',
      marketplace: 'shopee',
    });
  });

  it('reports a shop page with no item id as other', () => {
    expect(classifyPage('https://shopee.co.id/hobi_id')).toEqual({
      kind: 'other',
      marketplace: 'shopee',
    });
  });

  it('rejects a lookalike host', () => {
    expect(classifyPage('https://shopee.co.id.evil.com/Uji-Monitor-i.123.456')).toEqual({
      kind: 'unsupported',
      marketplace: null,
    });
  });
});

describe('classifyPage — unusable input', () => {
  it('returns unsupported instead of throwing', () => {
    expect(classifyPage('not a url')).toEqual({ kind: 'unsupported', marketplace: null });
    expect(classifyPage('')).toEqual({ kind: 'unsupported', marketplace: null });
  });
});
