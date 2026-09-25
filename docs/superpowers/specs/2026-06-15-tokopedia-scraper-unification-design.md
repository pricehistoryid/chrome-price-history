# Spec: Tokopedia Scraper Unification

## Goal
Improve the readability, maintainability, and uniformity of the Tokopedia scraper code by centralizing selectors and abstracting common scraping patterns.

## Scope
- `entrypoints/content/v3/scraper/tokopedia/`
- `clean.ts`, `pdp.ts`, `search.ts`, `wishlist.ts`

## Architecture & Data Flow

### 1. Centralized Selectors
Move all hardcoded selectors to a unified configuration object in `clean.ts` (or a new `config.ts`).

```typescript
export const TOKOPEDIA_CONFIG = {
  PDP: {
    namePath: "[data-testid='lblPDPDetailProductName']",
    pricePath: "[data-testid='lblPDPDetailProductPrice']",
    // ... other paths
  },
  SEARCH: {
    card: "div.css-5wh65g",
    url: "a",
    // ... other paths
  },
  // ...
};
```

### 2. Shared List Scraper Utility
Create a reusable function to handle list-based scraping (Search and Wishlist).

- **Function**: `scrapeProductList<T>(options: ListScrapeOptions): Promise<T[]>`
- **Responsibilities**:
    - Wait for initial element.
    - Handle batching (5 items at a time).
    - Provide small delays between batches.
    - Error handling per-item to prevent complete failure.
    - Filter out invalid results.

### 3. Refactored Scrapers
- **`pdp.ts`**: Use `TOKOPEDIA_CONFIG.PDP` and existing `FallbackRegistry`.
- **`search.ts`**: Use `scrapeProductList` with `TOKOPEDIA_CONFIG.SEARCH`.
- **`wishlist.ts`**: Use `scrapeProductList` with `TOKOPEDIA_CONFIG.WISHLIST`.

## Error Handling
- Per-item catch blocks in `scrapeProductList`.
- Validation of required fields (url, name) before returning data.

## Testing Strategy
- Verify that PDP scraping still works with new config.
- Verify that Search and Wishlist correctly batch and return data via the shared utility.
