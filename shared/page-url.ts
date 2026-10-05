/**
 * Which marketplace a URL belongs to, and which kind of page it is. The
 * content script writes the storage key and the popup reads it, so both must
 * come from here.
 *
 * Marketplaces are handled by one function rather than a plugin registry: two
 * hosts, two PDP rules, and a `switch` in the scraper is the whole surface.
 */

export type Marketplace = 'tokopedia' | 'shopee' | 'blibli' | 'lazada';

/** Hosts the extension records prices from. One owner for the whole allowlist. */
export const SUPPORTED_DOMAINS = ['tokopedia.com', 'shopee.co.id', 'blibli.com', 'lazada.co.id'] as const;

/** Page kinds the extension distinguishes. One closed vocabulary. */
export type ClassifiedPage =
  | { kind: 'pdp'; marketplace: Marketplace; productKey: string }
  | { kind: 'wishlist' | 'search' | 'other'; marketplace: Marketplace }
  | { kind: 'unsupported'; marketplace: null };

const TOKOPEDIA_PDP_PATH = /^\/[^/]+\/[^/]+-[a-z0-9]+/i;

/**
 * Shopee product URLs end in the item identity: `-i.<shopid>.<itemid>`.
 * Verified against a live page, whose canonical `og:url` had that shape.
 */
const SHOPEE_PDP_PATH = /-i\.\d+\.\d+$/;

/** Blibli product URLs are `/p/<slug>/ps--<sku>` or `/p/<slug>/is--<sku>`. */
const BLIBLI_PDP_PATH = /^\/p\//;

const LAZADA_PDP_PATH = /^\/products\//;

/**
 * Lazada serves one product under two shapes: the URL you browse adds the sku
 * (`-i<itemid>-s<skuid>.html`) while the page's canonical `og:url` keeps only
 * the item id (`-i<itemid>.html`). The sku is dropped so both reduce to the
 * form Lazada itself declares canonical, and one product cannot get two
 * records.
 */
const LAZADA_SKU_SUFFIX = /-s\d+(?=\.html$)/;

function hostBelongsTo(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function isSupportedHost(hostname: string): boolean {
  return SUPPORTED_DOMAINS.some((domain) => hostBelongsTo(hostname, domain));
}

export function classifyPage(url: string): ClassifiedPage {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: 'unsupported', marketplace: null };
  }

  const { hostname, pathname } = parsed;

  if (hostBelongsTo(hostname, 'tokopedia.com')) {
    // Order matters: /wishlist/foo-bar1 also matches TOKOPEDIA_PDP_PATH.
    if (pathname.startsWith('/wishlist/')) return { kind: 'wishlist', marketplace: 'tokopedia' };
    if (pathname === '/search') return { kind: 'search', marketplace: 'tokopedia' };
    if (TOKOPEDIA_PDP_PATH.test(pathname)) {
      return { kind: 'pdp', marketplace: 'tokopedia', productKey: `${parsed.origin}${pathname}` };
    }
    return { kind: 'other', marketplace: 'tokopedia' };
  }

  if (hostBelongsTo(hostname, 'shopee.co.id')) {
    if (SHOPEE_PDP_PATH.test(pathname)) {
      return { kind: 'pdp', marketplace: 'shopee', productKey: `${parsed.origin}${pathname}` };
    }
    if (pathname.startsWith('/search')) return { kind: 'search', marketplace: 'shopee' };
    return { kind: 'other', marketplace: 'shopee' };
  }

  if (hostBelongsTo(hostname, 'blibli.com')) {
    if (BLIBLI_PDP_PATH.test(pathname)) {
      return { kind: 'pdp', marketplace: 'blibli', productKey: `${parsed.origin}${pathname}` };
    }
    return { kind: 'other', marketplace: 'blibli' };
  }

  if (hostBelongsTo(hostname, 'lazada.co.id')) {
    if (LAZADA_PDP_PATH.test(pathname)) {
      const canonical = pathname.replace(LAZADA_SKU_SUFFIX, '');
      return { kind: 'pdp', marketplace: 'lazada', productKey: `${parsed.origin}${canonical}` };
    }
    return { kind: 'other', marketplace: 'lazada' };
  }

  return { kind: 'unsupported', marketplace: null };
}
