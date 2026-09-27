import { describe, expect, it } from 'vitest';
import { classifyPage } from '../shared/tokopedia-url';

describe('classifyPage', () => {
  it('keys a product page by origin and path, dropping the query string', () => {
    expect(classifyPage('https://www.tokopedia.com/shop-a/sepatu-abc123?search_id=xyz')).toEqual({
      kind: 'pdp',
      productKey: 'https://www.tokopedia.com/shop-a/sepatu-abc123',
    });
  });

  it('keys a product page that has no query string', () => {
    expect(classifyPage('https://www.tokopedia.com/shop-a/tas-def456')).toEqual({
      kind: 'pdp',
      productKey: 'https://www.tokopedia.com/shop-a/tas-def456',
    });
  });

  it('treats a wishlist path as wishlist even though it matches the product pattern', () => {
    expect(classifyPage('https://www.tokopedia.com/wishlist/foo-bar1')).toEqual({ kind: 'wishlist' });
  });

  it('recognizes the search page', () => {
    expect(classifyPage('https://www.tokopedia.com/search?q=sepatu')).toEqual({ kind: 'search' });
  });

  it('reports a non-product tokopedia page as tokopedia-other', () => {
    expect(classifyPage('https://www.tokopedia.com/')).toEqual({ kind: 'tokopedia-other' });
  });

  it('rejects a foreign host that merely contains the name in its path', () => {
    expect(classifyPage('https://evil.com/tokopedia.com/shop-a/sepatu-abc123')).toEqual({
      kind: 'not-tokopedia',
    });
  });

  it('rejects a lookalike host', () => {
    expect(classifyPage('https://tokopedia.com.evil.com/shop-a/sepatu-abc123')).toEqual({
      kind: 'not-tokopedia',
    });
  });

  it('returns not-tokopedia instead of throwing on unusable input', () => {
    expect(classifyPage('not a url')).toEqual({ kind: 'not-tokopedia' });
    expect(classifyPage('')).toEqual({ kind: 'not-tokopedia' });
  });
});
