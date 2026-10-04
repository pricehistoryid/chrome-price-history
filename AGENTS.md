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
            - `scraper/`: Contains scraping logic for different page types (PDP, search, wishlist).
            - `price-history.ts`: Core logic for managing and storing price data in `chrome.storage.local`.
            - `chart.ts`: Logic for rendering the price history charts.
            - `api.ts`: Synchronization with `pricehistory.id`.
    - `popup/`: The extension popup UI.
- `shared/`: Code used by more than one entrypoint — the Tokopedia page/URL classifier, the price sync queue, and the pricehistory.id product URL builder.
- `assets/`: Promotional and screen-recording assets.
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
| `pnpm postinstall` | Run `wxt prepare` to generate types and configuration. |

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
- `entrypoints/content/v3/scraper/tokopedia/pdp.ts`: Reference for Tokopedia Product Detail Page scraping logic.
- `entrypoints/content/v3/price-history.ts`: Reference for how data is processed and stored.
- `entrypoints/content/v3/inject.ts`: Reference for how the extension UI is added to e-commerce pages.
