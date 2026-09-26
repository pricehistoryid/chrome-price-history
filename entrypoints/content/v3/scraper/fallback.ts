/**
 * Strategy interface for data extraction
 */
export interface ExtractionStrategy {
    name: string;
    execute(selector: string, context?: Element): string | null;
}

/**
 * Strategy for XPath extraction
 */
export class XPathStrategy implements ExtractionStrategy {
    name = 'xpath';
    execute(xpath: string, context: Element = document.body): string | null {
        try {
            const result = document.evaluate(xpath, context, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            return result.singleNodeValue?.textContent?.trim() || null;
        } catch (e) {
            // Silently fail as this might be a CSS selector passed as fallback
            return null;
        }
    }
}

/**
 * Strategy for Heuristic extraction (Parent/Sibling traversal)
 */
export class HeuristicStrategy implements ExtractionStrategy {
    name = 'heuristic';
    execute(selector: string, context: Element = document.body): string | null {
        const isDev = import.meta.env.DEV;
        
        let keywords: string[] = [];
        const lowerSelector = selector.toLowerCase();
        
        if (lowerSelector.includes('price')) {
            keywords = ['Rp', 'IDR'];
        } else if (lowerSelector.includes('sold')) {
            keywords = ['Terjual', 'Sold'];
        } else if (lowerSelector.includes('rating')) {
            keywords = ['/5', 'stars'];
        } else {
            return null; // Cannot determine context
        }
        
        for (const word of keywords) {
            try {
                // Case-insensitive text search using XPath contains
                // We use '.' as context to search relative to context element
                const xpath = `.//*[contains(text(), "${word}")]`;
                const result = document.evaluate(xpath, context, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                const el = result.singleNodeValue as Element;
                
                if (el && el.textContent) {
                    const text = el.textContent.trim();
                    // Basic validation: ensure the text actually contains the word (XPath contains is sometimes broad)
                    if (text.toLowerCase().includes(word.toLowerCase())) {
                        if (isDev) {
                            console.log(`[Fallback] Heuristic match found for "${word}":`, el);
                        }
                        return text;
                    }
                }
            } catch (e) {
                if (isDev) console.warn(`Heuristic search failed for "${word}":`, e);
            }
        }
        
        return null;
    }
}

/**
 * Registry to manage fallback extraction strategies
 */
export class FallbackRegistry {
    private strategies: ExtractionStrategy[] = [];

    constructor() {
        // Initialize with default strategies
        this.addStrategy({
            name: 'css',
            execute: (selector, context = document.body) => {
                const el = context.querySelector(selector);
                return el ? el.textContent?.trim() || null : null;
            }
        });
        this.addStrategy(new XPathStrategy());
        this.addStrategy(new HeuristicStrategy());
    }

    addStrategy(strategy: ExtractionStrategy) {
        this.strategies.push(strategy);
    }

    execute(selector: string, context: Element = document.body): string | null {
        const isDev = import.meta.env.DEV;
        const isXPath = selector.startsWith('/') || selector.startsWith('(') || selector.startsWith('./');
        
        // Only try the detected strategy type to avoid syntax errors
        const order = isXPath ? ['xpath'] : ['css'];
        const logs: string[] = [];

        for (const type of order) {
            const strategy = this.strategies.find(s => s.name === type);
            if (!strategy) continue;

            const result = strategy.execute(selector, context);
            if (result) {
                if (isDev) {
                    console.log(`[Fallback] Success: ${type} strategy found data for "${selector}"`);
                }
                return result;
            }
            logs.push(type);
        }

        if (isDev) {
            console.warn(`[Fallback] Failed: ${logs.join(', ')} strategies for "${selector}". Trying heuristics...`);
        }

        const heuristic = this.strategies.find(s => s.name === 'heuristic');
        const result = heuristic?.execute(selector, context) || null;

        if (isDev && !result) {
            console.error(`[Fallback] All extraction strategies failed for "${selector}"`);
        }

        return result;
    }
}
