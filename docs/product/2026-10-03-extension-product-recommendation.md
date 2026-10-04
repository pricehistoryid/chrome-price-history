# Price History ID — Extension Product Recommendation

Date: 2026-10-03
Scope: `chrome-price-history` (the browser extension). The web app at `pricehistory.id` is out of scope except where the extension must interface with it.
Status: recommendation, not yet reviewed.

## 1. What the extension is today

Evidence from the code, not the README — the two disagree.

| Reality | Where | README/TODO says |
|---|---|---|
| Tokopedia only | `entrypoints/content/v3/scraper/tokopedia/*`, host permission `*://*.tokopedia.com/*` | "across Tokopedia, Shopee, Lazada, and Blibli" |
| PDP writes a local chart and POSTs to the API; search and wishlist pages POST to the API and show the user nothing | `event-listener.ts` → `processScraping` (`search`/`wishlist` branch calls `teardownModal()`, never `ph.save`) | "Complete price tracking" |
| Sync is live | `api.ts` → `UPDATE_PRODUCT_PRICE` → `background.ts` → `POST /api/v1/price` | "All data is stored locally until API synchronization is available" |
| `prevPrice` grows without limit; no cap or eviction | `price-history.ts` `saveNow` | "limited to 10 latest prices" |
| Affiliate code: none | no matches for `affiliate` outside README/TODO | Phase 1 deliverable |
| Analytics: none. No `alarms`, no `notifications` | `wxt.config.ts` permissions; no telemetry matches | TODO targets installs/DAU/rating |
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
| 8 | **Telemetry** — install, scrape success per marketplace, chart open, clickout, consent-gated | The TODO's own success criteria are unverifiable today | S | App endpoint |
| 9 | **Consent screen and Bahasa Indonesia copy** | Trust, and market fit for an Indonesian audience | S | — |
| 10 | **Storage policy** — cap or roll up `prevPrice` | Unbounded growth will hit quota; TODO's "10 records" cap is fiction | S | — |

### App owns (do not build in the extension)

- Price-drop notifications, watchlists, scheduled price checks.
- Account issuance, affiliate link minting, price history API.
- The dashboard users are actually retained by.

### Explicitly cut

`alarms` and `notifications` permissions. Adding them costs a re-consent prompt on update and buys capability that belongs server-side.

## 4. Live findings that change priority

- **`https://pricehistory.id/` returns HTTP 404** (Zoraxy "target host not found"), and so does `POST /api/v1/price`. Every price the extension has collected recently has been dropped silently. This makes item 3 the only piece of the backlog that is fixing active data loss.
- **Items 2 and 4 cannot be built right now.** Identity needs app-issued credentials, and a product deep link needs a verified app route; the app is offline and no route appears anywhere in the repo (only the root `https://pricehistory.id` link, already in the popup).
- **The shared token ships in the release artifact.** Any installed user can extract it and call the API as the extension.
- **The production manifest carries dev host permissions** for `localhost:3000` and `localhost:3001`, plus a `ws://localhost` CSP entry.

## 5. What is being implemented now, and why

**Item 1** — the repository currently tells users to load a `dist` folder that does not exist, claims marketplaces the code does not support, and has no privacy policy, which the store requires for this permission set. All three are cheap and unblock shipping.

**Item 3** — the API is down; each failed upload is enqueued locally instead of discarded, and a pending count is surfaced in the popup. Uploads resume on the next successful request, so no new permission is needed and no background alarm is required.

**Blocked, with reasons:** item 2 and item 4 need decisions and endpoints that only the app can provide (§4). Item 6 and item 7 are larger slices that want their own specs.

## 6. Success metrics for the extension

- Install → first tracked product → app account created → alert set. Each step is a rate to move.
- Sync success rate per marketplace, and pending-queue depth (item 3 makes this observable).
- Affiliate clicks per 100 PDP views (needs item 8).

## 7. Open questions

1. Does the app support per-device credentials, a batch price read, and affiliate link minting? Items 2, 4, 7 and 8 all wait on this.
2. Which business wins when they conflict — affiliate clicks, or maximum silent data collection? The two pull in opposite directions.
3. When is the app coming back up? Until then, everything the extension uploads is written to a queue and never delivered.
