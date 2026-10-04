# Spec: Popup Product Context

## Goal
Make the popup tell the truth about the active tab and surface the price history the extension already stores locally.

Today `entrypoints/popup/main.ts` (548 bytes) sets one line of text from `tab.url.includes('tokopedia.com')` and never reads `price_history`, so it reports "Tracking: Active" on the Tokopedia homepage or cart and shows no product data at all.

## Scope

In scope:
- A shared URL/page-type classifier that owns the PDP storage-key rule for both the popup and the content script.
- Popup reads `price_history` for the active tab's product and renders current price, lowest price, change, and record count.
- Honest status states for non-product pages and for a product that has not been recorded yet.
- Promote the existing `value` → `price` migration out of `PriceHistory` so the popup can reuse it.

Not in scope (deliberate):
- Sparkline / chart rendering in the popup.
- Actions: "open this product's chart" (needs a new popup→content-script message type) and "forget this product" (destructive write).
- Tracked-product count in non-PDP states — see Decisions.
- The 10-record storage cap the old roadmap claimed; it does not exist in code.
- Multi-marketplace support, any new permission, any new messaging channel.

## Architecture & Data Flow

### 1. Classifier contract — new `shared/tokopedia-url.ts`

Placed outside `entrypoints/`: a root `utils/` is auto-imported by WXT, and a new `entrypoints/<dir>/` risks being probed as an entrypoint.

```ts
export type ClassifiedPage =
  | { kind: 'pdp'; productKey: string }
  | { kind: 'wishlist' | 'search' | 'tokopedia-other' | 'not-tokopedia' };

export function classifyPage(url: string): ClassifiedPage;
```

- One closed vocabulary; there is no `isTokopedia` boolean that could contradict `kind`.
- `productKey` exists only on the `pdp` arm, so a product key for a search page is unrepresentable.
- `productKey === origin + pathname`, matching the key the content script writes (`entrypoints/content/v3/event-listener.ts`, `handleUrlChange`). Derived as `const { origin, pathname } = new URL(url); return `${origin}${pathname}`;`
- Normalization used by the fallback lookup strips `?query`, `#hash`, and one trailing `/`. It applies to the fallback comparison only; the exact-key lookup is byte-for-byte.

Three existing defects are fixed by lifting this logic into one place:

1. **Ordering.** `/wishlist/foo-bar1` matches the PDP pattern `/^\/[^/]+\/[^/]+-[a-z0-9]+/i` used today in `scrapeTokopedia`, so wishlist pages are misclassified as PDPs. `wishlist` and `search` must be tested before the PDP pattern.
2. **Host check.** The content script guards on `url.includes('tokopedia')`, which accepts `https://evil.com/tokopedia`. Use `hostname === 'tokopedia.com' || hostname.endsWith('.tokopedia.com')`, matching the manifest's `*://*.tokopedia.com/*`.
3. **Malformed input.** `new URL()` throws; `scrapeTokopedia`'s caller (`processScraping` via `handleUrlChange`) neither awaits nor catches, so this is an unhandled rejection today. `classifyPage` returns `{ kind: 'not-tokopedia' }` instead.

`scrapeTokopedia` switches to `classifyPage`, deleting its inline regexes and the `'merchant'` member of `tokopediaPageType` that is declared but never produced.

### 2. Popup read path

```
chrome.tabs.query({ active: true, currentWindow: true })
  → classifyPage(tab.url ?? '')
  → kind === 'pdp' ? chrome.storage.local.get(['price_history']) : skip read
  → findProductRecord(price_history, productKey)   // exact hit, else normalized fallback
  → buildProductSummary(record) ?? 'untracked'
  → render
```

- One storage read, PDP only. `chrome.storage.local.get` is key-granular, so the whole `price_history` object is returned regardless; there is no cheaper per-product read.
- `findProductRecord` tries the exact key first and only then the normalized scan, so a byte-exact match always wins over a fuzzy one. Keys written by earlier builds may carry query strings, and a mismatch must not read as "no data".
- Stored shape:

```ts
interface PriceData { time: string; price: number }   // time is 'YYYY-MM-DD'
interface StoredProduct { prevPrice: PriceData[]; lowestPrice: PriceData }
```

`prevPrice` is newest-first and a same-day price drop rewrites `prevPrice[0].price`, so index 0 is the current price.

### 3. Summary model — new `entrypoints/popup/product-summary.ts`

Pure functions: no DOM, no `chrome` access. Both take plain data, so both are unit-testable without a browser.

```ts
// Normalized fallback: tolerates keys written by earlier builds.
findProductRecord(priceHistory: unknown, productKey: string): StoredProduct | null;

interface ProductSummary {
  current: PriceData;          // prevPrice[0]
  lowest: PriceData;
  previous: PriceData | null;  // prevPrice[1]
  delta: number | null;        // current.price - previous.price
  recordCount: number;
  firstSeen: string;           // prevPrice.at(-1).time
}

buildProductSummary(record: unknown): ProductSummary | null;
```

Returns `null` for an empty, missing, or malformed record, which the popup renders as "not tracked yet".

Pre-refactor records store `{ value }` rather than `{ price }`, and only the private `PriceHistory.migratePriceData` knows that; a popup reading raw storage would compute `NaN`. Promote it to an exported `migratePriceData` in `entrypoints/content/v3/price-history.ts`, used by both the class and the popup — one owner, and unit-testable.

### 4. Render states

Existing DESIGN.md-conformant classes are reused (`.card-title` as the 12px uppercase micro-label, `.price-row` + `.current-price` for the 20px figure); styling follows `DESIGN.md`, not new invention.

| Condition | Card content |
|---|---|
| `pdp`, tracked | current price, lowest price, delta, "N records · since <date>" |
| `pdp`, untracked | "Not tracked yet — open this page to record it" |
| `search` | "Search page — tracking results as you scroll" |
| `wishlist` | "Wishlist — tracking saved items" |
| `tokopedia-other` | "Tokopedia page — no price to track here" |
| `not-tokopedia` | "Not a Tokopedia page" |
| read failed | "Couldn't read price data" |

```
┌────────────────────────────────┐
│ [icon]  Price History          │
├────────────────────────────────┤
│ CURRENT                        │
│ Rp1.000.000     ↓ Rp120.000    │
│ LOWEST  Rp850.000              │
│ 7 records · since 12 Aug 2026  │
├────────────────────────────────┤
│ [   Open Dashboard   ]         │
│   Part of the PriceHistory.id  │
└────────────────────────────────┘
```

- Delta is arrow **and** colour, never colour alone (WCAG 1.4.1): emerald ↓ for a drop, slate ↑ for a rise. `DESIGN.md`'s palette has no red, so a rise is neutral rather than green; introducing a red is a separate `DESIGN.md` amendment.
- Delta is the **absolute** difference (`current.price - previous.price`), rendered as `↓`/`↑` plus the formatted magnitude. A percentage would need a second model field for marginal value, so it is deliberately omitted. When `previous` is `null`, no delta is rendered at all — no zero, no placeholder.
- Formatting is pinned so it is deterministic to test: prices via `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })`; the `firstSeen` date via `Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })`, giving `12 Aug 2026`. The sketch above is indicative of layout, not of exact glyphs.
- `index.html` holds the static skeleton (labels and the empty card states, toggled with `hidden`); `main.ts` fills text values and unhides exactly one state. No DOM is constructed in JS, so DESIGN.md's markup stays reviewable in one place.
- The existing "Open Dashboard" link and footer are unchanged.
- No loading shimmer. `DESIGN.md` allows a pulse for data-heavy sections, but this is a single local storage read, so a pulse would flash for one frame and read as a glitch.

## Error Handling

- The card always reaches a named state; it never remains on "Checking Status..." (the current silent-stuck behaviour when `chrome.tabs.query` rejects).
- `chrome.tabs.query` failure or a storage read failure renders the "Couldn't read price data" state; the dashboard link stays available in every state.
- A record that is present but unusable (`buildProductSummary` returns `null`) is the untracked state, not the error state — missing data is not a failure.
- An absent or unparseable `tab.url` (`chrome://` pages, `undefined`) is `not-tokopedia`, not an exception.
- A `pdp` whose record is empty, partial (`prevPrice: []`), or legacy-shaped yields the untracked state rather than `NaN` or a crash.
- The non-PDP branch performs no storage read, so it has no storage failure mode.

## Testing Strategy

Existing vitest + jsdom setup, `tests/setup.ts`, no new dependencies.

- **`classifyPage`** — PDP with and without query string; wishlist-beats-PDP ordering (`/wishlist/foo-bar1`); search; Tokopedia homepage; non-Tokopedia host; `evil.com/tokopedia.com`; malformed string; `productKey` equals `origin + pathname`.
- **`migratePriceData`** — legacy `{ value }` converts to `{ price }`; modern records pass through unchanged.
- **`buildProductSummary`** — multi-record, single record (`delta: null`, `previous: null`), legacy `{ value }` entry, empty array, garbage input → `null`.
- **`findProductRecord`** — exact hit; hit only via query-string/trailing-slash normalization; miss → `null`; malformed `priceHistory` (array, string, `undefined`) → `null`.
- **Popup DOM** — mock `chrome.tabs.query` and `chrome.storage.local.get`, drive `main.ts`, assert the rendered text for each state, that exactly one state is visible, the formatted price, and the delta direction on a drop versus a rise. This is the regression net for both the false "Tracking: Active" status and the stuck state.

## Decisions

- **Tracked-product count in non-PDP states: deferred.** It would pull the storage read and its failure path into the non-PDP branch for one sentence of copy. Belongs with a portfolio phase, not here.
- **Normalized-key fallback scan: kept.** Without it, any key-shape drift fails silently as "no data", which is the class of bug this spec exists to remove.
- **`productKey` recomputed in the popup rather than fetched from the content script.** No new message type, and the popup still works on tabs where the content script never ran (page opened before an extension reload) as long as storage holds the product.
