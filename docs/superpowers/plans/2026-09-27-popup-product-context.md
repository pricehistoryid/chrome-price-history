# Popup Product Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the extension popup report the truth about the active tab and render the price history the extension already stores locally.

**Architecture:** A pure `classifyPage` module in `shared/` becomes the single owner of the Tokopedia page-type vocabulary and the PDP storage key, used by both the popup and the content script. The popup classifies the active tab, reads `price_history` once for the PDP case, maps the record to a view model with pure functions in `entrypoints/popup/product-summary.ts`, and unhides exactly one of the static states in `index.html`.

**Tech Stack:** TypeScript, WXT (MV3), Chrome Storage API, vitest + jsdom (already configured).

**Spec:** `docs/superpowers/specs/2026-09-27-popup-product-context-design.md`

## Global Constraints

- Run tests with `./node_modules/.bin/vitest run <path>`. Do **not** use `pnpm test` / `pnpm vitest` / `pnpm exec`: in this repo `pnpm <cmd>` triggers a full install and writes a stray `pnpm-workspace.yaml`.
- `./node_modules/.bin/tsc --noEmit` has 5 known pre-existing error groups. Do not fix them, and do not accept new ones: `chart.ts(241,20)`, `utils/validation.ts(151,38)`, `utils/validation.ts(152,34)`, `wxt.config.ts(38,5)`, and the `.ts`-extension imports plus `{time,value}` fixtures in `tests/chart-scaling.test.ts` / `tests/magnifier-tooltip.test.ts`.
- Popup is 320px wide. No new npm dependencies anywhere. No new extension permissions, and no new messaging channel between popup and content script.
- Card states are exactly: `loading`, `pdp-tracked`, `pdp-untracked`, `search`, `wishlist`, `tokopedia-other`, `not-tokopedia`, `error`. Exactly one is visible at a time; the card must never remain on `loading`.
- Prices render via `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })`. It emits a **non-breaking space** (U+00A0) after `Rp`, so assertions must normalize `\u00a0` to a plain space.
- Dates render via `Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })`. `timeZone: 'UTC'` is required: stored dates are `YYYY-MM-DD` and UTC parsing plus a negative-offset machine would otherwise shift the day.
- Delta is the absolute difference, rendered as `↓`/`↑` plus the formatted magnitude. No percentage. Render nothing when delta is `null` or `0`.
- Styling uses only the tokens in `DESIGN.md` (`--emerald`, `--slate`, `--gray`, 12px/8px radii, 4px grid). No new colours.

---

### Task 1: Classifier module

**Files:**
- Create: `shared/tokopedia-url.ts`
- Test: `tests/tokopedia-url.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `classifyPage(url: string): ClassifiedPage` and the `ClassifiedPage` union, imported by Task 3 (`../shared/tokopedia-url` from `entrypoints/content/v3/`) and Task 6 (`../../shared/tokopedia-url` from `entrypoints/popup/`). The `pdp` arm carries `productKey: string` equal to `origin + pathname`.

- [ ] **Step 1: Write the failing test**

Create `tests/tokopedia-url.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { classifyPage } from '../shared/tokopedia-url';

describe('classifyPage', () => {
  it('keys a product page by origin and path, dropping the query string', () => {
    expect(classifyPage('https://www.tokopedia.com/shop-a/sepatu-abc123?search_id=xyz')).toEqual({
      kind: 'pdp',
      productKey: 'https://www.tokopedia.com/shop-a/sepatu-abc123',
    });
  });

  it('keys a product page that has no query string', () => {
    expect(classifyPage('https://www.tokopedia.com/shop-a/tas-def456')).toEqual({
      kind: 'pdp',
      productKey: 'https://www.tokopedia.com/shop-a/tas-def456',
    });
  });

  it('treats a wishlist path as wishlist even though it matches the product pattern', () => {
    expect(classifyPage('https://www.tokopedia.com/wishlist/foo-bar1')).toEqual({ kind: 'wishlist' });
  });

  it('recognizes the search page', () => {
    expect(classifyPage('https://www.tokopedia.com/search?q=sepatu')).toEqual({ kind: 'search' });
  });

  it('reports a non-product tokopedia page as tokopedia-other', () => {
    expect(classifyPage('https://www.tokopedia.com/')).toEqual({ kind: 'tokopedia-other' });
  });

  it('rejects a foreign host that merely contains the name in its path', () => {
    expect(classifyPage('https://evil.com/tokopedia.com/shop-a/sepatu-abc123')).toEqual({
      kind: 'not-tokopedia',
    });
  });

  it('rejects a lookalike host', () => {
    expect(classifyPage('https://tokopedia.com.evil.com/shop-a/sepatu-abc123')).toEqual({
      kind: 'not-tokopedia',
    });
  });

  it('returns not-tokopedia instead of throwing on unusable input', () => {
    expect(classifyPage('not a url')).toEqual({ kind: 'not-tokopedia' });
    expect(classifyPage('')).toEqual({ kind: 'not-tokopedia' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run tests/tokopedia-url.test.ts`
Expected: FAIL — cannot resolve `../shared/tokopedia-url`.

- [ ] **Step 3: Write minimal implementation**

Create `shared/tokopedia-url.ts`:

```ts
/** Page kinds the extension distinguishes. One closed vocabulary. */
export type ClassifiedPage =
  | { kind: 'pdp'; productKey: string }
  | { kind: 'wishlist' | 'search' | 'tokopedia-other' | 'not-tokopedia' };

const PDP_PATH = /^\/[^/]+\/[^/]+-[a-z0-9]+/i;

/**
 * Classifies a URL and, for product pages, derives the `price_history`
 * storage key. The content script writes that key and the popup reads it,
 * so both must come from here.
 */
export function classifyPage(url: string): ClassifiedPage {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: 'not-tokopedia' };
  }

  const host = parsed.hostname;
  if (host !== 'tokopedia.com' && !host.endsWith('.tokopedia.com')) {
    return { kind: 'not-tokopedia' };
  }

  const path = parsed.pathname;
  // Order matters: /wishlist/foo-bar1 also matches PDP_PATH.
  if (path.startsWith('/wishlist/')) return { kind: 'wishlist' };
  if (path === '/search') return { kind: 'search' };
  if (PDP_PATH.test(path)) {
    return { kind: 'pdp', productKey: `${parsed.origin}${path}` };
  }
  return { kind: 'tokopedia-other' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run tests/tokopedia-url.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add shared/tokopedia-url.ts tests/tokopedia-url.test.ts
git commit -m "feat(shared): add tokopedia url classifier and product key"
```

---

### Task 2: Share the legacy price migration

**Files:**
- Modify: `entrypoints/content/v3/price-history.ts`
- Test: `tests/price-history.test.ts` (existing file; append a describe block)

**Interfaces:**
- Consumes: nothing.
- Produces: `export interface PriceData { time: string; price: number }` and `export function migratePriceData(data: any): PriceData`, imported by Task 4/5 (`../content/v3/price-history` from `entrypoints/popup/`). Legacy records are `{ time, value }` and must convert to `{ time, price }`.

- [ ] **Step 1: Write the failing test**

Append to `tests/price-history.test.ts` (keep the existing `describe('PriceHistory.save')` block; add the import to the existing import line so it reads `import { PriceHistory, migratePriceData } from '../entrypoints/content/v3/price-history';`):

```ts
describe('migratePriceData', () => {
  it('converts a legacy value record to price', () => {
    expect(migratePriceData({ time: '2026-08-12', value: '15000' })).toEqual({
      time: '2026-08-12',
      price: 15000,
    });
  });

  it('returns a modern record unchanged, by identity', () => {
    const record = { time: '2026-08-12', price: 15000 };
    expect(migratePriceData(record)).toBe(record);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run tests/price-history.test.ts`
Expected: FAIL — `migratePriceData` is not exported.

- [ ] **Step 3: Promote the private method to a module export**

In `entrypoints/content/v3/price-history.ts`, add `export` to the interfaces at the top:

```ts
export interface PriceData {
  time: string;
  price: number;
}
```

Delete the private method and place this module-level function immediately above `export class PriceHistory`:

```ts
/**
 * Pre-refactor records stored the price under `value`. The popup reads raw
 * storage, so it needs the same tolerance the save path has.
 */
export function migratePriceData(data: any): PriceData {
  if (data && data.value !== undefined && data.price === undefined) {
    return {
      time: data.time,
      price: Number(data.value)
    };
  }
  return data as PriceData;
}
```

Then update the two call sites inside `saveNow` from `this.migratePriceData(...)` to `migratePriceData(...)`:

```ts
      currentProduct.prevPrice = (currentProduct.prevPrice || []).map((p: any) => migratePriceData(p));
      currentProduct.lowestPrice = migratePriceData(currentProduct.lowestPrice);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./node_modules/.bin/vitest run tests/price-history.test.ts`
Expected: PASS, 3 tests (2 new + the existing save serialization test).

- [ ] **Step 5: Commit**

```bash
git add entrypoints/content/v3/price-history.ts tests/price-history.test.ts
git commit -m "refactor(content): share legacy price migration with consumers"
```

---

### Task 3: Content script uses the shared classifier

**Files:**
- Modify: `entrypoints/content/v3/event-listener.ts`

**Interfaces:**
- Consumes: `classifyPage` from Task 1.
- Produces: no new exports. `scrapeTokopedia` keeps its existing signature `(url: string) => Promise<tokopediaResult>`; `tokopediaPageType` narrows to `'pdp' | 'wishlist' | 'search'`.

Behaviour note: this task *intentionally* changes two things — wishlist pages stop being misclassified as PDPs (the ordering fix), and a foreign host containing `tokopedia` in its path stops being treated as Tokopedia. Both are the defects named in the spec.

- [ ] **Step 1: Replace the inline classification**

At the top of `entrypoints/content/v3/event-listener.ts`, add the import:

```ts
import { classifyPage } from '../../../shared/tokopedia-url';
```

Replace the `tokopediaPageType` type declaration — drop the `'merchant'` member, which is declared but never produced:

```ts
type tokopediaPageType = 'pdp' | 'wishlist' | 'search';
```

Replace the body of `scrapeTokopedia` with:

```ts
async function scrapeTokopedia(url: string): Promise<tokopediaResult> {
  const page = classifyPage(url);

  switch (page.kind) {
    case 'pdp': {
      const result = await scrapePDP(url);
      return {
        pageType: 'pdp',
        result: result ? [result] : null,
      };
    }

    case 'wishlist':
      return {
        pageType: 'wishlist',
        result: await scrapeWishlist(),
      };

    case 'search':
      return {
        pageType: 'search',
        result: await scrapeSearch(url),
      };

    default:
      return { pageType: null, result: null };
  }
}
```

This also removes the two `console.log` calls that were in the search branch.

- [ ] **Step 2: Drop the redundant, unsafe host guard**

In `processScraping`, delete the wrapper `if (url.includes('tokopedia')) { ... }` and its closing brace, so the `switch (result.pageType)` runs directly. The guard is now redundant (`classifyPage` already returned `not-tokopedia`, which falls to `default`), and `includes('tokopedia')` is the substring bug the classifier replaces. Behaviour is unchanged because the content script only runs on `*://*.tokopedia.com/*`.

- [ ] **Step 3: Verify behaviour is preserved**

Run: `./node_modules/.bin/vitest run`
Expected: PASS, all suites — 25 tests (15 existing + 8 classifier + 2 migration).

Run: `./node_modules/.bin/tsc --noEmit`
Expected: only the 5 known pre-existing error groups listed in Global Constraints.

- [ ] **Step 4: Verify the extension still builds**

Run: `./node_modules/.bin/wxt build`
Expected: `[success] Built extension`, `.output/chrome-mv3/manifest.json` present.

Note: this task has no unit test of its own — `scrapeTokopedia` reaches into live scrapers and `chrome`, which the existing suite does not mock. Its safety net is the classifier's tests (Task 1) plus the build and the type check.

- [ ] **Step 5: Commit**

```bash
git add entrypoints/content/v3/event-listener.ts
git commit -m "refactor(content): classify pages with the shared classifier"
```

---

### Task 4: Stored-record lookup

**Files:**
- Create: `entrypoints/popup/product-summary.ts`
- Test: `tests/product-summary.test.ts`

**Interfaces:**
- Consumes: `migratePriceData` and `PriceData` from Task 2.
- Produces: `export interface StoredProduct { prevPrice: PriceData[]; lowestPrice: PriceData }` and `export function findProductRecord(priceHistory: unknown, productKey: string): StoredProduct | null`, used by Task 5 and Task 6.

- [ ] **Step 1: Write the failing test**

Create `tests/product-summary.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findProductRecord } from '../entrypoints/popup/product-summary';

const KEY = 'https://www.tokopedia.com/shop-a/sepatu-abc123';

const record = {
  prevPrice: [{ time: '2026-08-12', price: 1000 }],
  lowestPrice: { time: '2026-08-12', price: 1000 },
};

describe('findProductRecord', () => {
  it('returns the record stored under the exact key', () => {
    expect(findProductRecord({ [KEY]: record }, KEY)).toBe(record);
  });

  it('finds a record stored under a legacy key carrying a query string', () => {
    expect(findProductRecord({ [`${KEY}?search_id=xyz`]: record }, KEY)).toBe(record);
  });

  it('finds a record stored under a legacy key with a trailing slash', () => {
    expect(findProductRecord({ [`${KEY}/`]: record }, KEY)).toBe(record);
  });

  it('prefers the exact key over a normalized match', () => {
    const normalizedOnly = { ...record, lowestPrice: { time: '2026-08-01', price: 900 } };
    const map = { [`${KEY}?q=1`]: normalizedOnly, [KEY]: record };
    expect(findProductRecord(map, KEY)).toBe(record);
  });

  it('returns null when the product is absent', () => {
    expect(findProductRecord({ 'https://www.tokopedia.com/other/x-y1': record }, KEY)).toBeNull();
  });

  it('returns null for unusable storage contents', () => {
    expect(findProductRecord(undefined, KEY)).toBeNull();
    expect(findProductRecord(null, KEY)).toBeNull();
    expect(findProductRecord('nope', KEY)).toBeNull();
    expect(findProductRecord([1, 2], KEY)).toBeNull();
    expect(findProductRecord({ [KEY]: { lowestPrice: record.lowestPrice } }, KEY)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run tests/product-summary.test.ts`
Expected: FAIL — cannot resolve `../entrypoints/popup/product-summary`.

- [ ] **Step 3: Write minimal implementation**

Create `entrypoints/popup/product-summary.ts`:

```ts
import type { PriceData } from '../content/v3/price-history';

export interface StoredProduct {
  prevPrice: PriceData[];
  lowestPrice: PriceData;
}

/** Keys written by earlier builds may carry a query string, hash, or trailing slash. */
function stripKeyNoise(key: string): string {
  return key.replace(/[?#].*$/, '').replace(/\/$/, '');
}

function isStoredProduct(value: unknown): value is StoredProduct {
  if (!value || typeof value !== 'object') return false;
  return Array.isArray((value as Partial<StoredProduct>).prevPrice);
}

/**
 * Exact key first, then a normalized scan so legacy key shapes still resolve
 * instead of silently reading as "no data".
 */
export function findProductRecord(priceHistory: unknown, productKey: string): StoredProduct | null {
  if (!priceHistory || typeof priceHistory !== 'object' || Array.isArray(priceHistory)) return null;
  const map = priceHistory as Record<string, unknown>;

  const exact = map[productKey];
  if (isStoredProduct(exact)) return exact;

  const needle = stripKeyNoise(productKey);
  for (const [key, value] of Object.entries(map)) {
    if (stripKeyNoise(key) === needle && isStoredProduct(value)) return value;
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run tests/product-summary.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add entrypoints/popup/product-summary.ts tests/product-summary.test.ts
git commit -m "feat(popup): look up stored product records"
```

---

### Task 5: Product summary view model

**Files:**
- Modify: `entrypoints/popup/product-summary.ts`
- Test: `tests/product-summary.test.ts`

**Interfaces:**
- Consumes: `findProductRecord`, `migratePriceData`, `PriceData`.
- Produces: `export interface ProductSummary { current: PriceData; lowest: PriceData; previous: PriceData | null; delta: number | null; recordCount: number; firstSeen: string }` and `export function buildProductSummary(record: unknown): ProductSummary | null`, used by Task 6.

- [ ] **Step 1: Write the failing test**

Append to `tests/product-summary.test.ts` (extend the import to `import { buildProductSummary, findProductRecord } from '../entrypoints/popup/product-summary';`):

```ts
describe('buildProductSummary', () => {
  it('reads the current price from the newest record and the delta from the previous one', () => {
    const summary = buildProductSummary({
      prevPrice: [
        { time: '2026-08-14', price: 1000 },
        { time: '2026-08-12', price: 1200 },
        { time: '2026-08-10', price: 1500 },
      ],
      lowestPrice: { time: '2026-08-14', price: 1000 },
    });

    expect(summary).toEqual({
      current: { time: '2026-08-14', price: 1000 },
      lowest: { time: '2026-08-14', price: 1000 },
      previous: { time: '2026-08-12', price: 1200 },
      delta: -200,
      recordCount: 3,
      firstSeen: '2026-08-10',
    });
  });

  it('has no delta when only one record exists', () => {
    const summary = buildProductSummary({
      prevPrice: [{ time: '2026-08-14', price: 1000 }],
      lowestPrice: { time: '2026-08-14', price: 1000 },
    });

    expect(summary?.delta).toBeNull();
    expect(summary?.previous).toBeNull();
    expect(summary?.recordCount).toBe(1);
    expect(summary?.firstSeen).toBe('2026-08-14');
  });

  it('migrates legacy value records', () => {
    const summary = buildProductSummary({
      prevPrice: [
        { time: '2026-08-14', value: '1000' },
        { time: '2026-08-12', value: '1200' },
      ],
      lowestPrice: { time: '2026-08-14', value: '1000' },
    });

    expect(summary?.current.price).toBe(1000);
    expect(summary?.delta).toBe(-200);
  });

  it('falls back to the current price when the lowest record is unusable', () => {
    const summary = buildProductSummary({
      prevPrice: [{ time: '2026-08-14', price: 1000 }],
      lowestPrice: { time: '2026-08-14' },
    });

    expect(summary?.lowest).toEqual({ time: '2026-08-14', price: 1000 });
  });

  it('returns null when there is nothing usable to show', () => {
    expect(buildProductSummary(null)).toBeNull();
    expect(buildProductSummary({ prevPrice: [], lowestPrice: { time: '2026-08-14', price: 1 } })).toBeNull();
    expect(buildProductSummary({ prevPrice: [{ time: '2026-08-14' }] })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run tests/product-summary.test.ts`
Expected: FAIL — `buildProductSummary` is not exported.

- [ ] **Step 3: Write minimal implementation**

Update the import at the top of `entrypoints/popup/product-summary.ts` to bring in the migration:

```ts
import { migratePriceData, type PriceData } from '../content/v3/price-history';
```

Add below `findProductRecord`:

```ts
export interface ProductSummary {
  current: PriceData;
  lowest: PriceData;
  previous: PriceData | null;
  delta: number | null;
  recordCount: number;
  firstSeen: string;
}

function isPriceData(value: unknown): value is PriceData {
  const candidate = value as Partial<PriceData> | null;
  return (
    !!candidate &&
    typeof candidate.time === 'string' &&
    typeof candidate.price === 'number' &&
    Number.isFinite(candidate.price)
  );
}

/**
 * `prevPrice` is newest-first, and a same-day price drop rewrites index 0, so
 * index 0 is the current price. Returns null when there is nothing usable.
 */
export function buildProductSummary(record: unknown): ProductSummary | null {
  if (!isStoredProduct(record)) return null;

  const prices = record.prevPrice.map(entry => migratePriceData(entry)).filter(isPriceData);
  if (prices.length === 0) return null;

  const current = prices[0];
  const previous = prices[1] ?? null;
  const storedLowest = migratePriceData(record.lowestPrice);

  return {
    current,
    lowest: isPriceData(storedLowest) ? storedLowest : current,
    previous,
    delta: previous ? current.price - previous.price : null,
    recordCount: prices.length,
    firstSeen: prices[prices.length - 1].time,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run tests/product-summary.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add entrypoints/popup/product-summary.ts tests/product-summary.test.ts
git commit -m "feat(popup): build the product summary view model"
```

---

### Task 6: The popup renders every state, including the tracked product

**Files:**
- Modify: `entrypoints/popup/index.html`
- Modify: `entrypoints/popup/main.ts`
- Test: `tests/popup.test.ts`

**Interfaces:**
- Consumes: `classifyPage` (Task 1), `findProductRecord` (Task 4), `buildProductSummary` and `ProductSummary` (Task 5).
- Produces: `export async function render(): Promise<void>`; the `data-state` vocabulary (`loading`, `pdp-tracked`, `pdp-untracked`, `search`, `wishlist`, `tokopedia-other`, `not-tokopedia`, `error`); and the `data-field` names (`current`, `delta`, `lowest`, `records`). `render` always leaves exactly one state visible.

Status states and tracked rendering are one deliverable, not two: a commit that fixed the statuses while leaving a tracked product as a blank card would be a regression against the popup users have today.

- [ ] **Step 1: Write the failing test**

Create `tests/popup.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '../entrypoints/popup/main';

function loadPopupMarkup() {
  // ponytail: String(import.meta.url) defeats Vite's static asset-URL rewrite, which
  // would otherwise resolve the literal form to an http://localhost:3000/ path that
  // readFileSync rejects with ERR_INVALID_URL_SCHEME.
  const html = readFileSync(new URL('../entrypoints/popup/index.html', String(import.meta.url)), 'utf8');
  document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
}

function visibleState(): string | undefined {
  const states = [...document.querySelectorAll<HTMLElement>('[data-state]')];
  return states.filter(el => !el.hidden).map(el => el.dataset.state)[0];
}

function setActiveTab(url: string) {
  (global as any).chrome.tabs = { query: vi.fn(async () => [{ url }]) };
  (global as any).chrome.storage.local.get = vi.fn(async () => ({}));
}

beforeEach(() => {
  loadPopupMarkup();
  setActiveTab('https://www.tokopedia.com/');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('popup states', () => {
  it('never leaves the card on the loading state', async () => {
    setActiveTab('https://www.tokopedia.com/');
    await render();
    expect(visibleState()).not.toBe('loading');
  });

  it('reports a non-tokopedia tab', async () => {
    setActiveTab('https://example.com/');
    await render();
    expect(visibleState()).toBe('not-tokopedia');
  });

  it('reports a tokopedia page that has no price to track', async () => {
    setActiveTab('https://www.tokopedia.com/');
    await render();
    expect(visibleState()).toBe('tokopedia-other');
  });

  it('reports search and wishlist pages', async () => {
    setActiveTab('https://www.tokopedia.com/search?q=sepatu');
    await render();
    expect(visibleState()).toBe('search');

    setActiveTab('https://www.tokopedia.com/wishlist/foo-bar1');
    await render();
    expect(visibleState()).toBe('wishlist');
  });

  it('reports a product that has not been recorded yet', async () => {
    setActiveTab('https://www.tokopedia.com/shop-a/sepatu-abc123');
    await render();
    expect(visibleState()).toBe('pdp-untracked');
  });

  it('reports an unreadable tab instead of staying silent', async () => {
    (global as any).chrome.tabs = { query: vi.fn(async () => { throw new Error('no access'); }) };
    await render();
    expect(visibleState()).toBe('error');
  });

  it('reports unreadable storage', async () => {
    setActiveTab('https://www.tokopedia.com/shop-a/sepatu-abc123');
    (global as any).chrome.storage.local.get = vi.fn(async () => { throw new Error('storage down'); });
    await render();
    expect(visibleState()).toBe('error');
  });
});

const trackedRecord = {
  prevPrice: [
    { time: '2026-08-14', price: 1000000 },
    { time: '2026-08-12', price: 1120000 },
  ],
  lowestPrice: { time: '2026-08-09', price: 850000 },
};

function fieldText(name: string): string {
  const el = document.querySelector<HTMLElement>(`[data-field="${name}"]`);
  return (el?.textContent ?? '').replace(/\u00a0/g, ' ');
}

function setStoredRecord(record: unknown) {
  (global as any).chrome.storage.local.get = vi.fn(async () => ({
    price_history: { 'https://www.tokopedia.com/shop-a/sepatu-abc123': record },
  }));
}

describe('popup tracked product', () => {
  beforeEach(() => {
    setActiveTab('https://www.tokopedia.com/shop-a/sepatu-abc123');
  });

  it('renders price, lowest, delta and record count', async () => {
    setStoredRecord(trackedRecord);

    await render();

    expect(visibleState()).toBe('pdp-tracked');
    expect(fieldText('current')).toBe('Rp 1.000.000');
    expect(fieldText('lowest')).toBe('Rp 850.000');
    expect(fieldText('delta')).toBe('↓ Rp 120.000');
    expect(fieldText('records')).toBe('2 records · since 12 Aug 2026');
  });

  it('shows a rise with its own class and no minus sign', async () => {
    setStoredRecord({
      prevPrice: [
        { time: '2026-08-14', price: 1200000 },
        { time: '2026-08-12', price: 1000000 },
      ],
      lowestPrice: { time: '2026-08-12', price: 1000000 },
    });

    await render();

    expect(fieldText('delta')).toBe('↑ Rp 200.000');
    expect(document.querySelector('[data-field="delta"]')?.className).toContain('up');
  });

  it('renders no delta for a single record', async () => {
    setStoredRecord({
      prevPrice: [{ time: '2026-08-14', price: 1000000 }],
      lowestPrice: { time: '2026-08-14', price: 1000000 },
    });

    await render();

    expect(visibleState()).toBe('pdp-tracked');
    expect(document.querySelector<HTMLElement>('[data-field="delta"]')?.hidden).toBe(true);
  });

  it('renders no delta when the price is unchanged', async () => {
    setStoredRecord({
      prevPrice: [
        { time: '2026-08-14', price: 1000000 },
        { time: '2026-08-12', price: 1000000 },
      ],
      lowestPrice: { time: '2026-08-14', price: 1000000 },
    });

    await render();

    expect(visibleState()).toBe('pdp-tracked');
    expect(document.querySelector<HTMLElement>('[data-field="delta"]')?.hidden).toBe(true);
  });

  it('tolerates a legacy value-shaped record', async () => {
    setStoredRecord({
      prevPrice: [
        { time: '2026-08-14', value: '1000000' },
        { time: '2026-08-12', value: '1120000' },
      ],
      lowestPrice: { time: '2026-08-09', value: '850000' },
    });

    await render();

    expect(visibleState()).toBe('pdp-tracked');
    expect(fieldText('current')).toBe('Rp 1.000.000');
    expect(fieldText('delta')).toBe('↓ Rp 120.000');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run tests/popup.test.ts`
Expected: FAIL — `render` is not exported; `data-state` elements do not exist.

- [ ] **Step 3: Mark up every state**

In `entrypoints/popup/index.html`, replace the `.card` block with — exactly one state is visible initially, and `render()` moves that:

```html
      <div class="card">
        <div class="card-title" data-state="loading">Checking…</div>
        <div class="card-text" data-state="pdp-untracked" hidden>Not tracked yet — open this page to record it</div>
        <div class="card-text" data-state="search" hidden>Search page — tracking results as you scroll</div>
        <div class="card-text" data-state="wishlist" hidden>Wishlist — tracking saved items</div>
        <div class="card-text" data-state="tokopedia-other" hidden>Tokopedia page — no price to track here</div>
        <div class="card-text" data-state="not-tokopedia" hidden>Not a Tokopedia page</div>
        <div class="card-text" data-state="error" hidden>Couldn't read price data</div>
        <div class="product-block" data-state="pdp-tracked" hidden>
          <div class="card-title">Current</div>
          <div class="price-row">
            <span class="current-price" data-field="current">—</span>
            <span class="price-delta" data-field="delta" hidden></span>
          </div>
          <div class="price-meta">
            <span class="card-title">Lowest</span>
            <span data-field="lowest">—</span>
          </div>
          <div class="caption" data-field="records">—</div>
        </div>
      </div>
```

Add these rules to the `<style>` block, next to `.card-title`:

```css
      .card-text {
        font-size: 12px;
        line-height: 1.5;
        color: var(--slate);
      }

      .product-block {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .price-meta {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        font-size: 12px;
        color: var(--gray);
      }

      .caption {
        font-size: 10px;
        line-height: 1.5;
        color: var(--gray);
      }

      .price-delta {
        font-size: 12px;
        font-weight: 600;
      }

      .price-delta.down {
        color: var(--emerald);
      }

      .price-delta.up {
        color: var(--slate);
      }
```

`.card-title` is uppercase, so it must not be used for the sentence states above — only for the `Current` / `Lowest` micro-labels.

- [ ] **Step 4: Implement the flow**

Replace the whole of `entrypoints/popup/main.ts` with:

```ts
import { classifyPage } from '../../shared/tokopedia-url';
import { buildProductSummary, findProductRecord } from './product-summary';

type CardState =
  | 'loading'
  | 'pdp-tracked'
  | 'pdp-untracked'
  | 'search'
  | 'wishlist'
  | 'tokopedia-other'
  | 'not-tokopedia'
  | 'error';

// Bound formatters: id-ID emits a non-breaking space after "Rp".
const formatIDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format;

// Stored dates are YYYY-MM-DD; UTC keeps the calendar day stable on any machine.
const formatDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
}).format;

function showState(name: CardState) {
  for (const el of document.querySelectorAll<HTMLElement>('[data-state]')) {
    el.hidden = el.dataset.state !== name;
  }
}

function setField(name: string, text: string) {
  const el = document.querySelector<HTMLElement>(`[data-field="${name}"]`);
  if (el) el.textContent = text;
}

function renderDelta(delta: number | null) {
  const el = document.querySelector<HTMLElement>('[data-field="delta"]');
  if (!el) return;

  if (delta === null || delta === 0) {
    el.hidden = true;
    el.textContent = '';
    return;
  }

  el.hidden = false;
  el.textContent = `${delta < 0 ? '↓' : '↑'} ${formatIDR(Math.abs(delta))}`;
  el.className = `price-delta ${delta < 0 ? 'down' : 'up'}`;
}

export async function render(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const page = classifyPage(tab?.url ?? '');

    if (page.kind !== 'pdp') {
      showState(page.kind);
      return;
    }

    const stored = await chrome.storage.local.get(['price_history']);
    const summary = buildProductSummary(findProductRecord(stored?.price_history, page.productKey));

    if (!summary) {
      showState('pdp-untracked');
      return;
    }

    setField('current', formatIDR(summary.current.price));
    setField('lowest', formatIDR(summary.lowest.price));
    setField(
      'records',
      `${summary.recordCount} records · since ${formatDate(new Date(summary.firstSeen))}`,
    );
    renderDelta(summary.delta);

    showState('pdp-tracked');
  } catch (error) {
    console.error('Popup: could not render price context', error);
    showState('error');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { void render(); });
} else {
  void render();
}
```

One `try`/`catch` covers both reads, because the spec routes a `chrome.tabs.query` failure and a storage failure to the same `error` state. The `document.readyState` check matters: the popup loads `main.ts` as a module at the end of `<body>`, and in jsdom the document is already loaded, so a bare `DOMContentLoaded` listener would never fire.

- [ ] **Step 5: Run tests to verify they pass**

Run: `./node_modules/.bin/vitest run tests/popup.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 6: Run the full suite and the type check**

Run: `./node_modules/.bin/vitest run`
Expected: PASS, all suites — 48 tests (15 existing + 8 classifier + 2 migration + 11 summary + 12 popup).

Run: `./node_modules/.bin/tsc --noEmit`
Expected: only the 5 known pre-existing error groups listed in Global Constraints.

- [ ] **Step 7: Verify the failure path in a real browser**

Run:

```bash
./node_modules/.bin/wxt build
python3 -m http.server 8777 --directory .output/chrome-mv3
```

Open `http://127.0.0.1:8777/popup.html`. Expected: the card reads "Couldn't read price data" — `chrome.tabs` is absent in a plain page, so `chrome.tabs.query` throws, `render()` takes its catch branch, logs one console error, and sets the `error` state. This is the proof that the old stuck "Checking Status..." state is gone. Stop the server with Ctrl-C afterwards.

- [ ] **Step 8: Commit**

```bash
git add entrypoints/popup/index.html entrypoints/popup/main.ts tests/popup.test.ts
git commit -m "feat(popup): report real tracking state and show price history"
```

---

---

## Self-Review

**Spec coverage**

| Spec requirement | Task |
|---|---|
| `classifyPage` union, `productKey === origin + pathname` | 1 |
| Wishlist ordering fix | 1 (test), 3 (adoption) |
| Host check rejects lookalikes and path-embedded names | 1 |
| Malformed URL returns `not-tokopedia` | 1 |
| `'merchant'` union member removed | 3 |
| `migratePriceData` exported and shared | 2 |
| `Value` → `price` legacy tolerance in the popup | 2, 5 |
| `findProductRecord` exact-first, then normalized fallback | 4 |
| `buildProductSummary` fields and `null` cases | 5 |
| Seven named states, never stuck on loading | 6 |
| Non-PDP branch performs no storage read | 6 |
| Error state for `tabs.query` and storage failure | 6 |
| Tracked rendering: price, lowest, delta, records, since-date | 6 |
| Delta arrow + colour, no percentage, hidden when null or 0 | 6 |
| Pinned IDR and UTC date formatting | 6 |
| Static skeleton in `index.html`, `main.ts` only fills and unhides | 6 |
| No new dependencies, permissions, or messaging | all (Global Constraints) |

**Type consistency:** `ClassifiedPage` and `classifyPage` are spelled identically in Tasks 1, 3, 6. `PriceData` is exported in Task 2 and consumed as a type import in Tasks 4, 5. `StoredProduct` is produced in Task 4, consumed in Task 5. `ProductSummary` field names (`current`, `lowest`, `previous`, `delta`, `recordCount`, `firstSeen`) match between Task 5's definition and Task 6's use. `CardState` is declared once in Task 6 and used by `showState`; the `data-state` values in the markup are the same eight strings.

**Known limits, stated rather than hidden:** Task 3 has no unit test (live scrapers and `chrome` are unmocked), so its safety net is the classifier's tests plus the build and type check. Task 6's `pdp-tracked` path is fully exercised only in jsdom; a real-browser check against a live product page remains outstanding, and Task 6's Step 7 only proves the failure path renders. Tokopedia's exact wishlist URL shape is inherited from the existing `startsWith('/wishlist/')` predicate and was not independently verified — if `/wishlist` without a trailing segment is the real shape, wishlist pages classify as `tokopedia-other`, unchanged from today's behaviour.
