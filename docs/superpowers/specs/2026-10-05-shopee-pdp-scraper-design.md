# Spec: Shopee PDP price scraping

Date: 2026-10-05
Status: implemented in this change set, pending review.

## Goal

Record prices from Shopee product pages the same way Tokopedia product pages are recorded: write the local price history, show the chart, and upload the price point.

## Evidence

Derived from a real logged-in Shopee PDP saved to `fixtures/shopee/pdp-1.html` (local only, never committed — `fixtures/` is gitignored). Two independent price sources exist in the served HTML:

1. **JSON-LD**, three `application/ld+json` blocks, one of which is a `Product`:

```json
{ "@type": "Product",
  "name": "Xteink X4 Pro dan Xteink X4 E-Reader - Ready Stock",
  "image": "https://down-id.img.susercontent.com/file/id-11134201-81ztf-mtbt12c47nr842",
  "offers": { "@type": "AggregateOffer", "lowPrice": "1600000.00", "highPrice": "1700000.00", "priceCurrency": "IDR" },
  "aggregateRating": { "ratingValue": "4.98", "ratingCount": "66" } }
```

2. **`og:` meta tags** — `og:title` (suffixed with `| Shopee Indonesia`), `og:image`, `og:url`.

3. **DOM** — the visible price is `Rp1.600.000 - Rp1.700.000` in a class-hashed div, and the sold count is `189 Terjual` in `<span class="PfWbfd">189</span> Terjual`. Class names are content-hashed (`Ocv3B8`, `PfWbfd`, `zrnbj5`), so they are not selectors worth depending on. `data-testid` appears only on `badge-video` and `a11y-label`.

Shopee sends no `sold` count in structured data, and no `shopid`/`itemid` JSON we can rely on beyond the URL itself.

## Extraction strategy

Prefer machine-readable data, fall back towards the DOM:

| Field | Primary | Fallback |
|---|---|---|
| name | JSON-LD `Product.name` | `og:title`, with the `\| Shopee Indonesia` suffix stripped |
| image_url | JSON-LD `Product.image` | `og:image` |
| price | the price in the page's `aria-live` region — the *selected* variant | JSON-LD `offers.lowPrice` / `offers.price` |
| rating | JSON-LD `aggregateRating.ratingValue` | DOM figure before the `penilaian` label |
| sold | — | first number in the element whose text contains `Terjual` |

### Why the price comes from the page, not from the JSON-LD

A second captured page with variants (`fixtures/shopee/pdp-2.html`) showed the split:

- JSON-LD carries an `AggregateOffer` for the whole item: `lowPrice 1475000`, `highPrice 1950000`. It never moves.
- The visible price sits in `<section aria-live="polite">` as `Rp1.475.000 - Rp1.950.000`, one such region per page in both captures.
- Selecting a variant rewrites that text — and changes **no URL**, so no URL watcher can see it.

So the price is read from the `aria-live` region (the low end while a range is displayed, since nothing is selected), and `watchShopeePrice` observes that region to re-run the scrape when the text changes. Verified on the captured page: the JSON-LD stayed at `1475000.00`, the scrape returned `1950000` after the price text was rewritten, and the watcher fired once.

## Decisions

- **Price ranges record the low end.** This product genuinely has two variants. The low end is what the listing advertises as its price and keeps the history comparable across time; storing the high end would make a cheap variant look like a price drop. Changing this later is one line.
- **A change within the same day replaces that day's point.** The write path used to keep only the day's lowest, which silently dropped every *rise* — including a switch to a more expensive variant, which is what a buyer sees. The all-time low is tracked separately in `lowestPrice`, so nothing is lost by letting the day's point follow the latest observation.
- **Shopee support is PDP only for v1.** Search and wishlist need their own scrapers, and Shopee's search markup is a different (card-based) shape we have not captured. Tokopedia's search and wishlist paths stay as they are.
- **The Shopee host permission ships now**, because the content script cannot run on a Shopee page without it. Existing users will see the new permission on update.
- **No affiliate links.** Unchanged from the 2026-10-04 decision: the extension scrapes, the app attaches affiliate links on its product page.

## Changes

- `shared/page-url.ts` (renamed from `shared/tokopedia-url.ts`) — the classifier now answers for two marketplaces. `ClassifiedPage` gains `marketplace` on the `pdp` arm, and the page-kind vocabulary is `pdp | wishlist | search | other | unsupported`, replacing the Tokopedia-specific `tokopedia-other` / `not-tokopedia`. The PDP rule for Shopee is the `-i.<shopid>.<itemid>` suffix, which also guarantees the item id is present in the storage key.
- `entrypoints/content/v3/scraper/shopee/pdp.ts` — `scrapeShopeePDP(url)` following `scrapePDP`'s contract: returns `ProductData | null`, never throws.
- `entrypoints/content/v3/event-listener.ts` — dispatch on `marketplace` instead of assuming Tokopedia.
- `entrypoints/popup/main.ts` + `index.html` — the two renamed states (`other`, `unsupported`) get honest Bahasa copy, since "Not a Tokopedia page" is wrong once Shopee is supported.
- `wxt.config.ts` — `*://*.shopee.co.id/*` added to host permissions; `web_accessible_resources` matches widened to the same set.

## Testing

- `tests/page-url.test.ts` — Tokopedia PDP/wishlist/search/hostile-host cases (existing coverage, renamed) plus Shopee PDP, Shopee non-product pages, a lookalike host, and malformed input.
- `tests/shopee-pdp.test.ts` — a synthetic fixture built to the shape of the captured page (JSON-LD `Product` + `Terjual` markup) with invented values, covering: AggregateOffer range, a single `Offer`, missing JSON-LD falling back to `og:` and DOM, malformed JSON-LD, and a page with no price at all returning `null` rather than a bogus `0`.
- The real captured page stays local. The committed fixture is hand-written, so no third-party listing content or session data enters the repository.

## Not covered

- Search and wishlist scraping for Shopee.
- Lazada and Blibli.
- Whether `pricehistory.id` accepts Shopee payloads and resolves `/product/<shopee-slug>`; until confirmed, the handoff link for a Shopee product is built with the same slug rule and may 404. The popup still shows local history either way.
