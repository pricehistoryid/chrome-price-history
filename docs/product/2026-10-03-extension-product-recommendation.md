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
3. **Monetize** — the affiliate clickout.

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
| 7 | **Affiliate MVP** — explicit buy buttons plus a redirect interstitial, never a silent URL rewrite | The whole revenue thesis; 0 lines exist | M | App must mint links |
| 8 | **Telemetry** — install, scrape success per marketplace, chart open, clickout, consent-gated | The roadmap's own success criteria are unverifiable today | S | App endpoint |
| 9 | **Consent screen and Bahasa Indonesia copy** | Trust, and market fit for an Indonesian audience | S | — |
| 10 | **Storage policy** — cap or roll up `prevPrice` | Unbounded growth will hit quota; the roadmap's "10 records" cap was never implemented | S | — |

### App owns (do not build in the extension)

- Price-drop notifications, watchlists, scheduled price checks.
- Account issuance, affiliate link minting, price history API.
- The dashboard users are actually retained by.

### Explicitly cut

`alarms` and `notifications` permissions. Adding them costs a re-consent prompt on update and buys capability that belongs server-side.

## 4. Live findings that change priority

- **`https://pricehistory.id/` returns HTTP 404** (Zoraxy "target host not found"), and so does `POST /api/v1/price`. Every price the extension has collected recently has been dropped silently. This makes item 3 the only piece of the backlog that is fixing active data loss.
- **The app's product route was recovered from its own sitemap.** Archived captures of `pricehistory.id/sitemap.xml` list product URLs, and captures of those pages returned HTTP 200 (last seen January 2025). The shape is `https://pricehistory.id/product/<product-url-without-scheme, dots and slashes as dashes>`, which is what item 4 now builds. Caveat: the newest capture is 21 months old and the live app is down, so the route is unverified against today's deployment — worth one click before shipping.
- **Item 2 still cannot be built.** Per-device identity needs credentials only the app can issue, and the app is offline.
- **The shared token ships in the release artifact.** Any installed user can extract it and call the API as the extension.
- **The production manifest carries dev host permissions** for `localhost:3000` and `localhost:3001`, plus a `ws://localhost` CSP entry.

## 5. Where the work stands

**Shipped**

- **Item 1** — README corrected (marketplaces, storage, install paths), CI runs the test suite and both builds before releasing, privacy policy added. The repository told users to load a `dist` folder that never existed and claimed marketplaces the code does not support.
- **Item 3** — failed uploads are queued locally and drained on the next successful request; the popup reports the backlog. The API is down, so this is currently the only thing standing between an outage and permanent data loss.
- **Item 4** — the popup's portal button and the chart modal's footer now deep-link to the product's page in the app, which is where tracking and alerts live. Uses the recovered route above.
- **Item 10** — local history is bounded: 365 points per product and 200 products, ranked by newest price date.

**Next, in order**

- **Item 6** — Shopee, then Lazada and Blibli. Biggest funnel expansion and the alert dataset grows with it.
- **Item 8** — telemetry, so the funnel below is measurable at all.

**Blocked, with reasons**

- **Item 2** (per-device identity) needs the app to issue credentials. Until then every install shares one token: no payouts, no per-install limits, no per-user alert data.
- **Item 7** (affiliate) needs the app to mint links.
- **Item 9** (Bahasa Indonesia copy) is a product decision, not a build task.

## 6. Success metrics for the extension

- Install → first tracked product → app account created → alert set. Each step is a rate to move.
- Sync success rate per marketplace, and pending-queue depth (item 3 makes this observable).
- Affiliate clicks per 100 PDP views (needs item 8).

## 7. Open questions

1. Does the app support per-device credentials, a batch price read, and affiliate link minting? Items 2, 4, 7 and 8 all wait on this.
2. Which business wins when they conflict — affiliate clicks, or maximum silent data collection? The two pull in opposite directions.
3. When is the app coming back up? Until then, everything the extension uploads is written to a queue and never delivered.
