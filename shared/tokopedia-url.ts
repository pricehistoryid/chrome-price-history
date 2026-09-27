/** Page kinds the extension distinguishes. One closed vocabulary. */
export type ClassifiedPage =
  | { kind: 'pdp'; productKey: string }
  | { kind: 'wishlist' | 'search' | 'tokopedia-other' | 'not-tokopedia' };

const PDP_PATH = /^\/[^/]+\/[^/]+-[a-z0-9]+/i;

/**
 * Classifies a URL and, for product pages, derives the `price_history`
 * storage key. The content script writes that key and the popup reads it,
 * so both must come from here.
 */
export function classifyPage(url: string): ClassifiedPage {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: 'not-tokopedia' };
  }

  const host = parsed.hostname;
  if (host !== 'tokopedia.com' && !host.endsWith('.tokopedia.com')) {
    return { kind: 'not-tokopedia' };
  }

  const path = parsed.pathname;
  // Order matters: /wishlist/foo-bar1 also matches PDP_PATH.
  if (path.startsWith('/wishlist/')) return { kind: 'wishlist' };
  if (path === '/search') return { kind: 'search' };
  if (PDP_PATH.test(path)) {
    return { kind: 'pdp', productKey: `${parsed.origin}${path}` };
  }
  return { kind: 'tokopedia-other' };
}
