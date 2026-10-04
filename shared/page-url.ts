/**
 * Which marketplace a URL belongs to, and which kind of page it is. The
 * content script writes the storage key and the popup reads it, so both must
 * come from here.
 *
 * Marketplaces are handled by one function rather than a plugin registry: two
 * hosts, two PDP rules, and a `switch` in the scraper is the whole surface.
 */

export type Marketplace = 'tokopedia' | 'shopee';

/** Hosts the extension records prices from. One owner for the whole allowlist. */
export const SUPPORTED_DOMAINS = ['tokopedia.com', 'shopee.co.id'] as const;

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

  return { kind: 'unsupported', marketplace: null };
}
