# Spec: Refactor 'value' to 'price' in Content V3

## Goal
Rename the incorrectly named `value` property to `price` across the `entrypoints/content/v3` directory for better clarity and consistency, while migrating existing user data in `chrome.storage.local`.

## Scope
- `entrypoints/content/v3/` only.
- Scrapers, interfaces, business logic, and storage keys.
- Exclude `v1` and `v2` as they are deprecated.

## Architecture & Data Flow

### 1. Interfaces
- **ProductData** (`scraper/result.ts`): Rename `value` (string | number) to `price`.
- **PriceData** (`price-history.ts`): Rename `value` (number) to `price`.
- **ProductData** (`price-history.ts`): Rename `value` to `price`.

### 2. Scrapers (Tokopedia)
- **pdp.ts**: Update result object to use `price`.
- **wishlist.ts**: Update result object to use `price`.
- **clean.ts**: Rename `cleanPrice(value)` parameter to `price`.

### 3. API Integration
- **api.ts**: Update `updateProductPrice` to use `validatedProduct.price`.
- **background.ts**: (Already uses `price` in payload, but ensure consistency if payload structure changes).

### 4. Validation
- **utils/validation.ts**: Update `validateProductData` to use `price`.

### 5. Storage Migration (`price-history.ts`)
- In `PriceHistory.save()`:
    - When loading `price_history` from `chrome.storage.local`.
    - Detect `PriceData` objects with a `value` property.
    - Rename `value` to `price`.
    - Update `lowestPrice` and `prevPrice` arrays.
    - Save back to storage with the new key.

### 6. Chart Compatibility (`chart.ts`)
- **Internal types**: Rename `PriceHistory` and `PriceData` fields to `price` where appropriate.
- **Library mapping**: Map `price` to `value` when calling `series.setData()` as `lightweight-charts` requires the literal `value` key for line series.

## Error Handling
- Ensure that missing `value` or `price` doesn't crash the scraper or chart.
- Validation logic should handle the transition period where some data might be in the old format.

## Testing Strategy
- Verify that scraping a Tokopedia PDP correctly sets the `price` field.
- Verify that existing history (mocked with `value` key) is correctly migrated and displayed in the chart.
- Verify that the API still receives the correct price in its payload.
