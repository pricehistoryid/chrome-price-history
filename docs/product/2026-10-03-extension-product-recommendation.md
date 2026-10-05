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
| The chart only ever shows prices this browser recorded | `chart.ts` renders `price_history` from `chrome.storage.local`; `api.ts` exposes POSTs only, and the one `fetch` in the codebase is the upload | "Buka halaman produk apa pun … dan lihat riwayat harganya" (store listing) — true only after the user has visited that product repeatedly |

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
| 11 | **History read path** — fetch the app's price history for the product being viewed and render it | The chart is local-only, so a fresh install shows a single point on the product and the dataset the app already holds never reaches the user. This is the difference between "a chart of your own visits" and "the price history you installed it for" | M | **Unblocked**: the app already serves `GET /api/v1/products/:slug/history` without a session (handoff §6a). What is left is the extension's client and one app decision: does a signed-out caller receive everyone's observations, or only its own? |

### App owns (do not build in the extension)

- Price-drop notifications, watchlists, scheduled price checks.
- Account issuance, per-device credentials, price history API.
- Affiliate link generation and clickout accounting. The extension hands the user to the product page and stops there.
- The dashboard users are actually retained by.

### Explicitly cut

`alarms` and `notifications` permissions. Adding them costs a re-consent prompt on update and buys capability that belongs server-side.

## 4. Live findings that change priority

- **`https://pricehistory.id/` returns HTTP 404** (Zoraxy "target host not found"), and so does `POST /api/v1/price`. Every price the extension has collected recently has been dropped silently. This makes item 3 the only piece of the backlog that is fixing active data loss.
- **The app's product slug changed with the rewrite, and the extension was still building the old one.** Item 4's rule came from the app's 2025 sitemap, which produced `www-tokopedia-com-<shop>-<slug>`. The current app generates the slug **at ingest** (`generateProductSlug` in `frontend-web/apps/api/src/utils/slug.ts`) — first host label plus path, lowercased, every run of non-alphanumerics collapsed to one hyphen — stores it, and keys both its `/product/:slug` route and `/products/:slug/history` off it. The extension now mirrors that function exactly, verified by running the app's own implementation and the extension's builder over the same URLs for all four marketplaces. Every handoff link built before this pointed at a 404, which matters because that clickout is the revenue path.
- **Item 2 still cannot be built.** Per-device identity needs credentials only the app can issue, and the app is offline.
- **The app is further along than assumed.** `frontend-web` (bun + React + Vite) is the dashboard and `frontend-web/apps/api` is a Hono API that already implements the ingest route, product slugging, `checkPriceAlerts`, a history read at `GET /api/v1/products/:slug/history`, plus `/price-drops` and `/all-time-low`. That removes the "the app has to build it" framing from items 11 and, for the alert side, confirms the 2026-10-04 decision to keep alerts out of the extension.
- **The ingest credential is a shared string, not a session.** `internalAuthMiddleware` compares the bearer token to `INTERNAL_API_KEY` with `!==`. The value in the app's dev env is the public jwt.io demo token (`sub: pricehistory`, `iat: 1516239022`); if that value ever reaches production, anyone who reads these notes can ingest data. Worth an explicit check.
- **That credential ships in the extension** — shown, not assumed: it was extracted from the project's own published 1.1.0 zip during this session by reading the string out of the bundled `background.js`. Any downloader can do the same, which is why it cannot serve as a per-user identity (item 2).

## 5. Where the work stands

**Shipped**

- **Item 1** — README corrected (marketplaces, storage, install paths, and two libraries it never used), CI runs the test suite, both builds and a type check before releasing, privacy policy added, and production manifests no longer request access to localhost. Firefox builds are MV3 with the extension ID AMO requires. The repository told users to load a `dist` folder that never existed and claimed marketplaces the code does not support.
- **Item 3** — failed uploads are queued locally and drained on the next successful request; the popup reports the backlog. The API is down, so this is currently the only thing standing between an outage and permanent data loss.
- **Item 4** — the popup's portal button and the chart modal's footer now deep-link to the product's page in the app, which is where tracking and alerts live. With affiliate links out of scope, this clickout is the revenue path. Uses the recovered route above.
- **Item 10** — local history is bounded: 365 points per product and 200 products, ranked by newest price date.
- **Item 6 (product pages on all four marketplaces)** — Tokopedia, Shopee, Blibli, and Lazada product pages are recorded. Shopee, Blibli, and Lazada are read from JSON-LD for identity and from the page for price, because none of the three keeps the buyer's price in structured data: Shopee carries the item's range, Blibli the promo range, Lazada no price at all. Verified by running the built scrapers against captured pages for each. Each also watches its price element, since a variant selection changes the price without changing the URL.
- **Item 9** — the popup, the chart modal, and the extension description speak Bahasa Indonesia, dates format as `id-ID`, and the popup header shows the title its stylesheet already expected. `docs/store-listing.md` carries the listing copy, the per-permission justifications CWS asks for, the data-disclosure answers, and two 1280×800 screenshots rendered from the real build (the chart one bundles `chart.ts`, so it is the real chart, not a drawing). The README shows both instead of the stale promotion gif.

**Hygiene, since 1.1.0 shipped**

- The API URL follows the build mode — `pnpm dev` → localhost, `pnpm build` → pricehistory.id — with **no fallback**, so a development build queues its batches instead of writing into the production dataset.
- The floating button's mark loads from the extension, not a mutable GitHub branch, so it survives being offline.
- The retry queue holds **5,000** observations instead of 500. Mine was roughly one browsing session, and while the API is down that queue is the only copy of what the extension has seen.
- Firefox's manifest declares its data collection (`websiteActivity`, `websiteContent`); `addons-linter` now reports **zero errors, warnings and notices**, which was the last thing standing between the Firefox build and a submission.

**Next, in order**

- **Item 11 (history read path)** — first, because it decides whether a new install is worth keeping: the chart is local-only today, so a fresh user sees one point and the app's history never reaches them. The endpoint already exists (`GET /api/v1/products/:slug/history`, no session required), so this is extension work plus one app decision about what a signed-out caller may see.
- **Item 6 (rest)** — search and wishlist pages for Shopee, Blibli, and Lazada. Each wants the captured-page-fixture treatment the product pages got; selectors derived from a real saved page, never guessed.
- **Item 5** (local half only) — the popup shows what the extension has stored. The search-card chips still need the app to serve prices.
- **Item 8** — telemetry, narrowed: installs, scrape success per marketplace, chart open. Clickouts are the app's to count.

**Blocked, with reasons**

- **Item 2** (per-device identity) needs the app to issue credentials. Until then every install shares one token: no per-install limits and no per-user alert data.
- **Item 1b** (store submission) — the pack is written, the screenshots exist and the AMO blockers are cleared, so the only real question is timing. With the chart local-only (item 11), a new user's first impression is an almost-empty chart. Either ship a read endpoint first, or expect the first reviews to say so; the alternative is softening the listing copy to promise "harga dan tren yang Anda lihat sendiri", which is true but a weaker pitch.

## 6. Success metrics for the extension

- Install → first tracked product → app product page → account created → alert set. Each step is a rate to move.
- Sync success rate per marketplace, and pending-queue depth (item 3 makes this observable).
- Clickouts to app product pages per 100 PDP views. The extension cannot count these — the click leaves for the app — so the app has to count arrivals. With affiliate links out of scope, this is the revenue funnel.

## 7. Open questions

1. Does the app support per-device credentials? Item 2 waits on it, and so does anything that needs to tell one install from another.
2. Does the app's product page attach an affiliate link, and does it count arrivals that came from the extension? If not, item 4's clickout carries no revenue and the handoff needs another destination.
3. When is the app coming back up? Until then every upload is queued and never delivered, and the recovered `/product/...` route stays unverified.
4. Can the app expose a product's price history to the extension, and does that history include other users' observations? Item 11 and the store listing's promise both turn on it.
