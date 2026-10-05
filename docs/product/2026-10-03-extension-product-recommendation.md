# Price History ID — Extension Product Recommendation

Date: 2026-10-03
Scope: `chrome-price-history` (the browser extension). The web app at `pricehistory.id` is out of scope except where the extension must interface with it.
Status: recommendation, not yet reviewed.

## 1. What the extension is today

Evidence from the code, not the README — the two disagree.

| Reality | Where | README/roadmap said |
|---|---|---|
| Tokopedia only | `entrypoints/content/v3/scraper/tokopedia/*`, host permission `*://*.tokopedia.com/*` | "across Tokopedia, Shopee, Lazada, and Blibli" |
| PDP writes a local chart and POSTs to the API; search and wishlist pages POST to the API and show the user nothing | `event-listener.ts` → `processScraping` (`search`/`wishlist` branch calls `teardownModal()`, never `ph.save`) | "Complete price tracking" |
| Sync is live | `api.ts` → `UPDATE_PRODUCT_PRICE` → `background.ts` → `POST /api/v1/price` | "All data is stored locally until API synchronization is available" |
| `prevPrice` grows without limit; no cap or eviction | `price-history.ts` `saveNow` | "limited to 10 latest prices" |
| Affiliate code: none | no matches for `affiliate` outside README and the roadmap | Phase 1 deliverable |
| Analytics: none. No `alarms`, no `notifications` | `wxt.config.ts` permissions; no telemetry matches | the roadmap targeted installs/DAU/rating |
| One shared JWT is compiled into every install | `background.ts` reads `VITE_API_JWT_TOKEN`; token present in `.output/chrome-mv3/background.js` | — |
| CI builds and releases but never runs the test suite | `.github/workflows/main.yml` | "Test thoroughly" |

## 2. Strategic reframe

Alerts belong to `pricehistory.id`, not the extension. That settles what this repo is for:

1. **Acquire** — get the extension installed, get the user onto the app.
2. **Supply** — feed the dataset that powers app-side alerts.
3. **Hand off** — send the user to the product's page on the app, which is where affiliate links are attached and alerts are set. The extension generates no affiliate links itself (decided 2026-10-04).

Retention is therefore not the extension's job. "No reason to return" is not a bug to fix here; it is a **handoff** to fix. Extension DAU is the wrong metric — installs, sync success rate, and install → signup → clickout are the right ones.

## 3. Backlog by owner

### Extension owns

Ordered by leverage.

| # | Item | Why it matters | Effort | Depends on |
|---|---|---|---|---|
| 1 | **Ship blockers**: privacy policy, store listing, README corrections, CI test gate | Nothing else counts until it is installable from a store | S | — |
| 2 | **Per-device identity** to replace the shared JWT | Without it: no per-user payouts, no per-install rate limiting, no per-user alert data | M | App must issue device credentials |
| 3 | **Durable sync** — persist failed uploads, retry later, show pending count | Silent drops are missing alert data; today the API is returning 404 and every upload is discarded with only a `console.error` | M | — |
| 4 | **Handoff bridge** — link from the extension into the app where tracking and alerts live | Converts extension traffic into app accounts, which is where retention exists | S | App route contract (blocked, see §5) |
| 5 | **On-page value** — portfolio in the popup, "lowest price" chip on search/wishlist cards | Makes the harvesting defensible; search and wishlist pages currently give the user nothing | M | — |
| 6 | **Marketplace coverage** — Shopee, then Lazada, Blibli | Volume in Indonesia; also widens the alert dataset | M each | — |
| 7 | ~~**Affiliate MVP**~~ — **dropped from the extension** (2026-10-04). The flow is: extension gathers data → links to the product's page on the app → the app attaches the affiliate link. Item 4's clickout is therefore the entire revenue path. | Link generation, attribution, and marketplace compliance all stay in one place | — | — |
| 8 | **Telemetry** — install, scrape success per marketplace, chart open, clickout, consent-gated | The roadmap's own success criteria are unverifiable today | S | App endpoint |
| 9 | **Consent screen and Bahasa Indonesia copy** | Trust, and market fit for an Indonesian audience | S | — |
| 10 | **Storage policy** — cap or roll up `prevPrice` | Unbounded growth will hit quota; the roadmap's "10 records" cap was never implemented | S | — |

### App owns (do not build in the extension)

- Price-drop notifications, watchlists, scheduled price checks.
- Account issuance, per-device credentials, price history API.
- Affiliate link generation and clickout accounting. The extension hands the user to the product page and stops there.
- The dashboard users are actually retained by.

### Explicitly cut

`alarms` and `notifications` permissions. Adding them costs a re-consent prompt on update and buys capability that belongs server-side.

## 4. Live findings that change priority

- **`https://pricehistory.id/` returns HTTP 404** (Zoraxy "target host not found"), and so does `POST /api/v1/price`. Every price the extension has collected recently has been dropped silently. This makes item 3 the only piece of the backlog that is fixing active data loss.
- **The app's product route was recovered from its own sitemap.** Archived captures of `pricehistory.id/sitemap.xml` list product URLs, and captures of those pages returned HTTP 200 (last seen January 2025). The shape is `https://pricehistory.id/product/<product-url-without-scheme, dots and slashes as dashes>`, which is what item 4 now builds. Caveat: the newest capture is 21 months old and the live app is down, so the route is unverified against today's deployment — worth one click before shipping.
- **Item 2 still cannot be built.** Per-device identity needs credentials only the app can issue, and the app is offline.
- **The shared token ships in the release artifact.** Any installed user can extract it and call the API as the extension.

## 5. Where the work stands

**Shipped**

- **Item 1** — README corrected (marketplaces, storage, install paths, and two libraries it never used), CI runs the test suite, both builds and a type check before releasing, privacy policy added, and production manifests no longer request access to localhost. Firefox builds are MV3 with the extension ID AMO requires. The repository told users to load a `dist` folder that never existed and claimed marketplaces the code does not support.
- **Item 3** — failed uploads are queued locally and drained on the next successful request; the popup reports the backlog. The API is down, so this is currently the only thing standing between an outage and permanent data loss.
- **Item 4** — the popup's portal button and the chart modal's footer now deep-link to the product's page in the app, which is where tracking and alerts live. With affiliate links out of scope, this clickout is the revenue path. Uses the recovered route above.
- **Item 10** — local history is bounded: 365 points per product and 200 products, ranked by newest price date.
- **Item 6 (product pages on all four marketplaces)** — Tokopedia, Shopee, Blibli, and Lazada product pages are recorded. Shopee, Blibli, and Lazada are read from JSON-LD for identity and from the page for price, because none of the three keeps the buyer's price in structured data: Shopee carries the item's range, Blibli the promo range, Lazada no price at all. Verified by running the built scrapers against captured pages for each. Each also watches its price element, since a variant selection changes the price without changing the URL.
- **Item 9** — the popup, the chart modal, and the extension description speak Bahasa Indonesia, dates format as `id-ID`, and the popup header shows the title its stylesheet already expected. `docs/store-listing.md` carries the listing copy, the per-permission justifications CWS asks for, the data-disclosure answers, and two 1280×800 screenshots rendered from the real build (the chart one bundles `chart.ts`, so it is the real chart, not a drawing). The README shows both instead of the stale promotion gif.

**Next, in order**

- **Item 6 (rest)** — search and wishlist pages for Shopee, Blibli, and Lazada. Each wants the captured-page-fixture treatment the product pages got; selectors derived from a real saved page, never guessed.
- **Item 5** (local half only) — the popup shows what the extension has stored. The search-card chips still need the app to serve prices.
- **Item 8** — telemetry, narrowed: installs, scrape success per marketplace, chart open. Clickouts are the app's to count.

**Blocked, with reasons**

- **Item 2** (per-device identity) needs the app to issue credentials. Until then every install shares one token: no per-install limits and no per-user alert data.
- **Item 1b** (store submission) — the pack is written and the assets exist; only the submission waits on the app answering, plus the two AMO notices (`data_collection_permissions`, `tooltip.innerHTML`). Publishing a handoff funnel that 404s wastes the first review cycle.

## 6. Success metrics for the extension

- Install → first tracked product → app product page → account created → alert set. Each step is a rate to move.
- Sync success rate per marketplace, and pending-queue depth (item 3 makes this observable).
- Clickouts to app product pages per 100 PDP views. The extension cannot count these — the click leaves for the app — so the app has to count arrivals. With affiliate links out of scope, this is the revenue funnel.

## 7. Open questions

1. Does the app support per-device credentials and a batch price read? Items 2 and 8 wait on it.
2. Does the app's product page attach an affiliate link, and does it count arrivals that came from the extension? If not, item 4's clickout carries no revenue and the handoff needs another destination.
3. When is the app coming back up? Until then every upload is queued and never delivered, and the recovered `/product/...` route stays unverified.
