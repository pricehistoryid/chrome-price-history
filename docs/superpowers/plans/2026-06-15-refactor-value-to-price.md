# Refactor 'value' to 'price' Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename incorrectly named `value` property to `price` across content v3 and migrate storage.

**Architecture:** Rename internal properties and storage keys; map to `value` only for `lightweight-charts` library.

**Tech Stack:** TypeScript, Chrome Storage API, WXT.

---

### Task 1: Update Shared Interfaces and Validation

**Files:**
- Modify: `entrypoints/content/v3/scraper/result.ts`
- Modify: `entrypoints/content/v3/utils/validation.ts`

- [ ] **Step 1: Rename `value` to `price` in `ProductData` interface**
Update `entrypoints/content/v3/scraper/result.ts`.

- [ ] **Step 2: Update validation logic**
Update `entrypoints/content/v3/utils/validation.ts` to use `price` property.

---

### Task 2: Update Scrapers and API

**Files:**
- Modify: `entrypoints/content/v3/scraper/tokopedia/clean.ts`
- Modify: `entrypoints/content/v3/scraper/tokopedia/pdp.ts`
- Modify: `entrypoints/content/v3/scraper/tokopedia/wishlist.ts`
- Modify: `entrypoints/content/v3/api.ts`

- [ ] **Step 1: Update Scraper logic (PDP, Wishlist, Clean)**
Rename all occurrences of `value` to `price` in scraper result objects.

- [ ] **Step 2: Update API integration**
Update `entrypoints/content/v3/api.ts` to use `validatedProduct.price`.

---

### Task 3: Storage Migration and Logic Refactor

**Files:**
- Modify: `entrypoints/content/v3/price-history.ts`

- [ ] **Step 1: Update internal interfaces and save logic**
Rename `value` to `price` in `ProductData` and `PriceData` interfaces.

- [ ] **Step 2: Implement on-the-fly migration in `save()`**
Add logic to detect and convert old `value` keys to `price` when loading from storage.

---

### Task 4: Chart Mapping

**Files:**
- Modify: `entrypoints/content/v3/chart.ts`

- [ ] **Step 1: Update internal types and map for library**
Rename internal `PriceHistory` fields. Map `price` to `value` when calling `series.setData()`.
