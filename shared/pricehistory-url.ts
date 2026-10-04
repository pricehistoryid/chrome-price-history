/**
 * Where pricehistory.id keeps a product. The app owns this route; the
 * extension only builds the link.
 *
 * Recovered from the app's own sitemap (archived captures returned HTTP 200):
 *   https://www.tokopedia.com/<shop>/<slug>
 *   → https://pricehistory.id/product/www-tokopedia-com-<shop>-<slug>
 *
 * The slug drops the scheme, then turns every "." and "/" into "-".
 */

export const SITE_ORIGIN = 'https://pricehistory.id';

export function productPageUrl(productKey: string): string {
  const slug = productKey
    .replace(/^[a-z]+:\/\//i, '')
    .replace(/\/+$/, '')
    .replace(/[./]/g, '-');

  return `${SITE_ORIGIN}/product/${encodeURIComponent(slug)}`;
}
