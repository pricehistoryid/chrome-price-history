# Spec: Blibli and Lazada PDP price scraping

Date: 2026-10-05
Status: implemented in this change set, pending review.

## Goal

Record prices from Blibli and Lazada product pages like Tokopedia's and Shopee's: write the local price history, show the chart, upload the price point.

## Evidence

From captured logged-in pages, kept local only (`fixtures/`, gitignored).

### Blibli — `www.blibli.com/p/<slug>/ps--<sku>`

- JSON-LD `Product` with `name`, `image` (a *thumbnail* URL), `aggregateRating` (`ratingValue: 4`, `ratingCount: 23`) and `offers` as an `AggregateOffer` — `lowPrice: 200000`, `highPrice: 292600`.
- The DOM price is **not** that range: `[data-testid="priceComponentOffered"]` holds `Rp185.000`, the price after the page's own 32% discount. It occurs once per page.
- Full-size image in `og:image`; JSON-LD carries the `/thumbnail/` variant.
- `Terjual 139` in `.sold-seen-label`.

### Lazada — `www.lazada.co.id/products/<slug>-i<itemid>-s<skuid>.html`

- JSON-LD `Product` has `name`, `image` as an **array**, and an `offers` object with **no price at all** — only `url`, `seller`, `availability`, `itemCondition`.
- No `aggregateRating`.
- The sale price is `.pdp-v2-product-price-content-salePrice-amount` (`1.845.000`), next to a struck-through `.pdp-v2-product-price-content-originalPrice-amount` (`Rp1.899.000`).
- The only rating and sold figures on the page — `4.8 /5` and `40.2K Terjual oleh Toko` — describe the **store**, not the product.
- The browsed URL carries the sku; the page's canonical `og:url` keeps only the item id (`-i<itemid>.html`).

## Extraction strategy

| Marketplace | name / image | price | rating | sold |
|---|---|---|---|---|
| Blibli | JSON-LD `name`; `og:image` first, JSON-LD image as fallback | `[data-testid="priceComponentOffered"]`, falling back to `offers.lowPrice` | JSON-LD `aggregateRating.ratingValue` | `.sold-seen-label`, `Terjual <n>` |
| Lazada | JSON-LD `name`, first entry of the `image` array | `.pdp-v2-product-price-content-salePrice-amount` (JSON-LD has no price to fall back to) | none — reported as unknown | none — reported as unknown |

## Decisions

- **The DOM price wins on both.** Blibli's structured data describes the promo *range*, and Lazada's describes no price at all, so JSON-LD cannot answer "what does this cost right now". This is the same conclusion Shopee forced, for a different reason each time.
- **Lazada's store-level rating and sold count are reported as unknown**, not copied into fields that mean "this product's rating" and "units of this product sold". Sending them would be a quiet lie in the app's data. `rating: null` and `sold: ''` are the payload's own "unknown" convention, which the upload path maps to `0`.
- **Blibli's image comes from `og:image`**, because JSON-LD carries the thumbnail variant.
- **Lazada's product key drops the sku**: `/products/<slug>-i<itemid>-s<skuid>.html` and the page's canonical `/products/<slug>-i<itemid>.html` both reduce to the canonical form, so browsing a product from a listing and from a shared link produces one record, not two.
- **Both get a price watcher**, since both can change the price in place when a variant is selected, exactly as Shopee does.

## Changes

- `entrypoints/content/v3/scraper/page-data.ts` — the helpers the three DOM-priced marketplaces now share: `jsonLdNodes`, `metaContent`, `textOf`, `amountsIn`/`amountFrom`, `waitFor` and `watchText`. Shopee's scraper was rewritten onto them, so `waitFor` and the watcher exist once rather than three times.
- `entrypoints/content/v3/scraper/blibli/pdp.ts`, `.../lazada/pdp.ts` — the two scrapers, each exporting `scrape*PDP` and `watch*Price`.
- `shared/page-url.ts` — Blibli and Lazada arms in the classifier, and both hosts in the one allowlist the upload validator uses.
- `entrypoints/content/v3/event-listener.ts` — scrapers and watchers are looked up by marketplace instead of a two-way branch.
- `wxt.config.ts` + `entrypoints/content.ts` — `*://*.blibli.com/*` and `*://*.lazada.co.id/*` in host permissions, the content-script matches, and `web_accessible_resources`.

## Testing

- `tests/blibli-pdp.test.ts`, `tests/lazada-pdp.test.ts` — synthetic fixtures built to the captured shapes: the DOM price beating Blibli's JSON-LD range, Lazada's sale price beating the struck-through original, the store figures staying unknown, `og:image` beating the JSON-LD thumbnail, missing price and missing product block both returning `null`, the watchers firing on an in-place price change, and the payload passing the upload validator.
- `tests/page-data.test.ts` — the shared helpers, including that `waitFor` is bounded and `watchText` stays quiet on an unchanged value.
- `tests/page-url.test.ts` — both hosts, both Lazada URL shapes collapsing to one key, lookalike hosts rejected.
- Verified against the captured pages by running the built scrapers in a browser: Blibli returned `185000` (not the JSON-LD `200000`), rating `4` and sold `139`; Lazada returned `1845000` (not the original `1899000`); both watchers fired once when the price text was rewritten to a new value, and both scrapes then returned the new price.

## Not covered

- Search and wishlist pages for either marketplace, and variants as separate identities.
- Whether `pricehistory.id` accepts Blibli and Lazada payloads, and whether its `/product/<slug>` route resolves their slugs — unverified while the app is down.
