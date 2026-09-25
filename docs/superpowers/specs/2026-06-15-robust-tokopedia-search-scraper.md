# Spec: Robust Tokopedia Search Scraper (Refined)

## Goal
Improve the reliability and completeness of the Tokopedia search scraper by handling fragile selectors and lazy-loaded content, while respecting the user's browsing experience and optimizing network requests.

## Scope
- `entrypoints/content/v3/scraper/tokopedia/search.ts`
- `entrypoints/content/v3/scraper/tokopedia/clean.ts`
- `entrypoints/content/v3/api.ts` (caching logic)

## Architecture & Data Flow

### 1. Robust Search Selectors
Update `TOKOPEDIA_SELECTORS.SEARCH` to use broader matching and include data-testids where available.

- **Name**: `[data-testid='lblSRPProductName'], .+tnoqZhn89`
- **Price**: `[data-testid='lblSRPProductPrice'], .urMOIDHH7I0Iy1Dv2oFaNw`
- **Image**: `img[alt='product-image'], .loWbMM9lKTafPiUjqt9UWA img`

### 2. Fallback Integration for Items
Refactor `processSearchElement` to use a `FallbackRegistry` instance for each card.
- If explicit selectors fail to find a field (like price), the `HeuristicStrategy` will attempt to find it via keyword matching ("Rp", "IDR").

### 3. Passive Scroll-to-Load (User-Driven)
Instead of eager scrolling, the scraper will:
- **Observe Scroll**: Monitor the page's scroll position or use an `IntersectionObserver` on product cards.
- **On-Demand Processing**: Only process and send data for product cards that have been scrolled into view and fully loaded (non-skeleton state).

### 4. Search Result Caching
Implement a temporary cache to avoid duplicate API calls for the same product during a search session.
- **Storage**: Use an in-memory `Set` or `Map` (URL-based) within the search scraper's scope.
- **Logic**: Before calling `updateProductPrice(product)`, check if the `product.url` has already been processed in the current session.

### 5. Skeletal State Handling
- **Logic**: Skip cards that contain the `IOLazyloading` class or lack a valid product name/URL. Wait for these elements to transition to a loaded state before processing.

## Error Handling
- Use the shared `scrapeProductList` utility's per-item error handling.
- Log failures in dev mode via the `FallbackRegistry`.

## Testing Strategy
- Verify that products are only scraped after they are scrolled into view.
- Verify that duplicate product captures (from multiple scroll events) are blocked by the cache.
- Verify that price is correctly captured via heuristics if selectors fail.
