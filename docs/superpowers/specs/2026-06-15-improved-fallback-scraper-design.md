# Spec: Improved Fallback Scraper Mechanism

## Goal
Make the fallback scraper smarter, more efficient, and easier to debug across various e-commerce platforms by implementing auto-detection of selector types, keyword-based heuristics, and conditional debug logging.

## Scope
- `entrypoints/content/v3/scraper/fallback.ts`
- Integration with existing scrapers (e.g., PDP scraper)

## Architecture & Data Flow

### 1. Smart Selector Detection
The `FallbackRegistry` will no longer require the caller to specify the strategy type (CSS vs XPath).
- **Auto-Detection Logic**:
    - If string starts with `/`, `(`, or `./`, treat as **XPath**.
    - Otherwise, treat as **CSS**.
- **Execution Strategy**:
    - Try the detected strategy first.
    - If it fails, try the alternative strategy (e.g., if CSS failed, try as XPath just in case).
    - If both fail, move to Heuristics.

### 2. Keyword-Based Heuristics
A last-resort strategy that searches the DOM for data points using common e-commerce keywords.
- **Price**: Search for "Rp", "IDR", or currency-formatted text.
- **Sold**: Search for "Sold", "Terjual", or numeric counts near sales icons.
- **Rating**: Search for "/5", "stars", or average rating patterns (e.g., `4.8`).
- **Implementation**: Uses `TreeWalker` or `document.evaluate` with text matching.

### 3. Dev-Only Debug Logging
Provide visibility into the extraction process during development without polluting production logs.
- **Trigger**: `import.meta.env.DEV`
- **Output**:
    - Log every strategy attempt.
    - Indicate success/failure clearly.
    - Log the actual DOM element found on success for easy inspection.
    - Summary of the failure chain if multiple attempts were made.

## Performance Considerations
- Skip result caching (requested by user).
- Use efficient DOM traversal for heuristics to avoid locking the UI thread on large pages.

## Testing Strategy
- Mock various DOM structures (some with CSS-only targets, some with XPath-only).
- Verify that "Rp" text triggers the price heuristic correctly.
- Verify that logs are absent when `import.meta.env.DEV` is false.
