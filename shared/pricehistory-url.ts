/**
 * Where pricehistory.id keeps a product. The app owns this route; the extension
 * only builds the link.
 *
 * The rule mirrors the app's own `generateProductSlug`
 * (`frontend-web/apps/api/src/utils/slug.ts`), which runs **at ingest** and is
 * stored on the product row. Both the web route (`/product/:slug`) and the API
 * (`/products/:slug`, `/products/:slug/history`) are keyed by it, so a
 * mismatch here is a 404 on the product page.
 *
 * An earlier version of this file was derived from the app's 2025 sitemap,
 * where slugs looked like `www-tokopedia-com-<shop>-<slug>`. The rewritten app
 * drops `www` and the TLD, keeps the first host label, and collapses every run
 * of non-alphanumerics to one hyphen — so those links no longer resolve.
 */

export const SITE_ORIGIN = 'https://pricehistory.id';

/**
 * The product's slug, as the app generates it: `<first host label>-<path>`,
 * lowercased, with every run of non-alphanumerics collapsed to a single hyphen.
 */
export function productSlug(productKey: string): string {
  let parsed: URL;
  try {
    parsed = new URL(productKey);
  } catch {
    try {
      parsed = new URL(`https://${productKey.replace(/^\/+/, '')}`);
    } catch {
      return '';
    }
  }

  const host = parsed.hostname.replace(/^www\./, '');
  const baseDomain = host.split('.')[0] ?? '';

  return `${baseDomain}-${parsed.pathname}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export function productPageUrl(productKey: string): string {
  return `${SITE_ORIGIN}/product/${productSlug(productKey)}`;
}
