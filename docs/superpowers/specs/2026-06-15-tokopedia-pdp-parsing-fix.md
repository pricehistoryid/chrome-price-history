# Spec: Tokopedia PDP Parsing Fix

## Goal
Fix parsing failures on Tokopedia Product Detail Pages (PDP) by updating URL detection logic and making DOM selectors more robust.

## Scope
- `entrypoints/content/v3/event-listener.ts`
- `entrypoints/content/v3/scraper/tokopedia/clean.ts`
- `entrypoints/content/v3/scraper/tokopedia/pdp.ts`

## Architecture & Data Flow

### 1. URL Detection Update
Update the regex used to identify Tokopedia PDPs to support alphanumeric IDs at the end of product slugs.

- **File**: `entrypoints/content/v3/event-listener.ts`
- **Old Regex**: `/^\/[^/]+\/[^/]+-\d+/`
- **New Regex**: `/^\/[^/]+\/[^/]+-[a-z0-9]+/i`

### 2. Robust Selector Configuration
Update `TOKOPEDIA_SELECTORS.PDP` to use broader attribute matching for fields that frequently change their test IDs.

- **File**: `entrypoints/content/v3/scraper/tokopedia/clean.ts`
- **Updates**:
    - `rating`: `[data-testid*='Rating']` (previously `[data-testid='lblPDPDetailProdukRating']`)
    - `sold`: `[data-testid*='Sold']` (previously `[data-testid='lblPDPDetailProdukSold']`)
    - `magnifier`: `[data-testid='PDPImageMagnifier'], img[alt^='Gambar']`

### 3. Scraper Logic refinement
Ensure the PDP scraper handles the new selectors and captures the first image if the magnifier is missing.

- **File**: `entrypoints/content/v3/scraper/tokopedia/pdp.ts`
- **Change**: If `magnifierEl` is an `img` tag, use its `src` instead of `backgroundImage`.

## Error Handling
- The `FallbackRegistry` will still provide a final layer of safety if these explicit selectors fail.

## Testing Strategy
- Verify both reported URLs are now correctly identified as PDPs.
- Verify that name, price, rating, and sold count are successfully extracted from the previously failing page.
