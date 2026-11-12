/** Read the selector's own syntax first, then try nearby keyword text. */
export function extractWithFallback(selector: string, context: Element = document.body): string | null {
    const isDev = import.meta.env.DEV;
    const isXPath = selector.startsWith('/') || selector.startsWith('(') || selector.startsWith('./');
    const type = isXPath ? 'xpath' : 'css';
    let result: string | null = null;

    if (isXPath) {
        try {
            const node = document.evaluate(selector, context, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            result = node.singleNodeValue?.textContent?.trim() || null;
        } catch {
            // XPath can fail for a malformed selector; allow the keyword fallback.
        }
    } else {
        result = context.querySelector(selector)?.textContent?.trim() || null;
    }

    if (result) {
        if (isDev) console.log(`[Fallback] Success: ${type} strategy found data for "${selector}"`);
        return result;
    }

    if (isDev) console.warn(`[Fallback] Failed: ${type} strategies for "${selector}". Trying heuristics...`);

    const lowerSelector = selector.toLowerCase();
    const keywords = lowerSelector.includes('price') ? ['Rp', 'IDR']
        : lowerSelector.includes('sold') ? ['Terjual', 'Sold']
        : lowerSelector.includes('rating') ? ['/5', 'stars']
        : [];
    if (keywords.length === 0) return null;

    for (const word of keywords) {
        try {
            const xpath = `.//*[contains(text(), "${word}")]`;
            const node = document.evaluate(xpath, context, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            const el = node.singleNodeValue as Element | null;
            if (el?.textContent) {
                const text = el.textContent.trim();
                if (text.toLowerCase().includes(word.toLowerCase())) {
                    if (isDev) console.log(`[Fallback] Heuristic match found for "${word}":`, el);
                    return text;
                }
            }
        } catch (e) {
            if (isDev) console.warn(`Heuristic search failed for "${word}":`, e);
        }
    }

    if (isDev) console.error(`[Fallback] All extraction strategies failed for "${selector}"`);
    return null;
}
