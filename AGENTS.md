# Price History ID - Context & Guidelines

## Project Overview
Price History ID is a browser extension (Chrome & Firefox) built with the **WXT** framework. Its primary goal is to track and visualize price history for products on Indonesian e-commerce platforms, specifically **Tokopedia**. It uses **Lightweight Charts** for data visualization and stores price data locally via `chrome.storage.local`.

### Core Technologies
- **Framework:** [WXT](https://wxt.dev/) (Web Extension Toolbox)
- **Language:** TypeScript
- **Bundler:** Vite
- **Charts:** Lightweight Charts (TradingView)
- **Manifest Version:** 3 (MV3)
- **Package Manager:** pnpm

---

## Directory Structure & Architecture

- `entrypoints/`: Contains the extension's entry points.
    - `background.ts`: The service worker for the extension.
    - `content/`: Versioned content scripts.
        - `v3/`: **Current Active Version** (TypeScript).
            - `inject.ts`: Handles UI injection (modals, buttons) into the host page.
            - `scraper/`: One module per marketplace and page type — `tokopedia/{pdp,search,wishlist}.ts`, `shopee/pdp.ts`, `blibli/pdp.ts`, `lazada/pdp.ts` — plus `page-data.ts` (shared JSON-LD, meta, amount and watcher helpers), `fallback.ts` strategies and `result.ts` payload shape.
            - `price-history.ts`: Core logic for managing and storing price data in `chrome.storage.local`.
            - `chart.ts`: Logic for rendering the price history charts.
            - `api.ts`: Synchronization with `pricehistory.id`.
    - `popup/`: The extension popup UI.
- `shared/`: Code used by more than one entrypoint — the Tokopedia page/URL classifier, the price sync queue, and the pricehistory.id product URL builder.
- `assets/`: Promotional assets, including the store screenshots under `assets/store/`.
- `public/`: Static assets like extension icons.
- `wxt.config.ts`: WXT and Manifest configuration.

---

## Building and Running

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all project dependencies. |
| `pnpm dev` | Start the development server for Chrome (auto-reloads). |
| `pnpm dev:firefox` | Start the development server for Firefox. |
| `pnpm build` | Build the extension for production (Chrome). |
| `pnpm build:firefox` | Build the extension for production (Firefox). |
| `pnpm zip` | Package the built extension into a ZIP file for distribution. |
| `pnpm test` | Run the test suite. |
| `pnpm exec tsc --noEmit` | Type-check the project (CI gates on this). |
| `pnpm postinstall` | Run `wxt prepare` to generate types and configuration. |

**Environment:** the API URL is per build mode — `.env.development` (localhost) for `pnpm dev`, `.env.production` (pricehistory.id) for `pnpm build`. There is no fallback, so a dev build cannot upload to production. Machine-specific overrides go in `.env.development.local`; the JWT lives in the untracked `.env`. Precedence, verified against this repo's Vite: `.env.[mode].local` > `.env.[mode]` > `.env.local` > `.env`.

---

## Development Conventions

- **TypeScript:** All new features must be implemented in TypeScript within the `v3/` content script directory.
- **Scraper Pattern:** Marketplaces and page types should have dedicated scrapers in `entrypoints/content/v3/scraper/`. Scrapers should be robust against DOM changes (using multiple selectors/fallbacks).
- **Storage:** Price history is stored in `chrome.storage.local` under the key `price_history`, indexed by the product URL.
- **WXT Entrypoints:** Follow WXT's convention for naming and placing entrypoints. Content scripts are typically placed in `entrypoints/content/`.
- **UI Injection:** Use `elFactory` (found in `inject.ts`) or similar utilities to safely create and inject DOM elements to avoid XSS and maintain structure.

---

## Key Files
- `wxt.config.ts`: Manifest permissions, host permissions, and Vite build settings.
- `entrypoints/content/v3/scraper/tokopedia/pdp.ts`: Reference for Tokopedia Product Detail Page scraping logic (DOM selectors with fallbacks).
- `entrypoints/content/v3/scraper/shopee/pdp.ts`: Reference for scraping a marketplace that publishes product JSON-LD (structured data for identity, the DOM for price). Selectors were derived from real saved pages, which stay out of the repo under the gitignored `fixtures/`.
- `entrypoints/content/v3/scraper/page-data.ts`: The shared helpers for marketplaces whose price is only in the DOM, including the price watcher that makes variant selection re-scrape.
- `entrypoints/content/v3/price-history.ts`: Reference for how data is processed and stored.
- `entrypoints/content/v3/inject.ts`: Reference for how the extension UI is added to e-commerce pages.
