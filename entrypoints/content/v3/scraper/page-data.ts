/**
 * Helpers shared by the marketplaces whose price only exists in the DOM.
 *
 * Shopee, Blibli and Lazada all publish JSON-LD, but none of them keeps the
 * *buyer's* price there: Shopee carries the item's range, Blibli the promo
 * range, and Lazada no price at all. So structured data answers for identity
 * (name, image, sometimes rating) and the DOM answers for price.
 */

export type Json = Record<string, any>;

const LD_JSON_SELECTOR = 'script[type="application/ld+json"]';

/** Every JSON-LD node of a given `@type`, skipping malformed blocks. */
export function jsonLdNodes(type: string): Json[] {
  const nodes: Json[] = [];

  for (const script of document.querySelectorAll<HTMLScriptElement>(LD_JSON_SELECTOR)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(script.textContent ?? '');
    } catch {
      continue; // one bad block must not hide the others
    }

    for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
      if (node && typeof node === 'object' && (node as Json)['@type'] === type) {
        nodes.push(node as Json);
      }
    }
  }

  return nodes;
}

export function metaContent(property: string): string {
  const el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  return el?.content?.trim() ?? '';
}

export function textOf(selector: string, root: ParentNode = document): string {
  return root.querySelector(selector)?.textContent?.trim() ?? '';
}

/**
 * Every figure in the text, as whole rupiah: `1.845.000` and `Rp185.000` are
 * thousands-separated, so the separators are dropped rather than parsed as
 * decimals. Returns them in the order they appear, so callers can take the
 * first or the lowest.
 */
export function amountsIn(text: string): number[] {
  return (text.match(/\d[\d.,]*/g) ?? [])
    .map((digits) => Number(digits.replace(/[.,]/g, '')))
    .filter((value) => Number.isFinite(value) && value > 0);
}

export function amountFrom(text: string): number | null {
  return amountsIn(text)[0] ?? null;
}

/** Polls `read` until it answers, so a client-rendered page is not read too early. */
export function waitFor<T>(read: () => T | null, timeoutMs: number, pollMs = 150): Promise<T | null> {
  const immediate = read();
  if (immediate) return Promise.resolve(immediate);

  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const timer = setInterval(() => {
      const found = read();
      if (found || Date.now() >= deadline) {
        clearInterval(timer);
        resolve(found);
      }
    }, pollMs);
  });
}

/**
 * Calls `onChange` when the text inside `rootSelector` changes — selecting a
 * variant rewrites the price without any navigation, so no URL watcher sees
 * it. `read` is given the root so it can scope its own query.
 *
 * Returns a disposer; call it before arming another one.
 */
export function watchText(
  rootSelector: string,
  read: (root: Element) => string,
  onChange: () => void,
  { debounceMs = 150 }: { debounceMs?: number } = {},
): () => void {
  const root = document.querySelector(rootSelector);
  if (!root) return () => {};

  let lastText = read(root);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const observer = new MutationObserver(() => {
    const text = read(root);
    if (text === lastText) return;

    lastText = text;
    clearTimeout(timer);
    timer = setTimeout(onChange, debounceMs);
  });

  observer.observe(root, { childList: true, subtree: true, characterData: true });

  return () => {
    clearTimeout(timer);
    observer.disconnect();
  };
}
