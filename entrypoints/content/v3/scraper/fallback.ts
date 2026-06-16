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
            console.warn('XPath evaluation failed:', e);
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
        // Simple heuristic: look for similar elements by class if direct selector fails
        const baseElement = context.querySelector(selector);
        if (baseElement) return baseElement.textContent?.trim() || null;

        // Try searching for similar nodes by text pattern if possible
        console.log(`Heuristic search for: ${selector}`);
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

    async execute(selector: string, context: Element = document.body): Promise<string | null> {
        for (const strategy of this.strategies) {
            console.log(`Executing extraction strategy: ${strategy.name}`);
            const result = strategy.execute(selector, context);
            if (result) return result;
        }
        return null;
    }
}
