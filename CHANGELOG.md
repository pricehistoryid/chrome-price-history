# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]
- Client-side navigation on Shopee re-runs the scraper instead of leaving the first product's chart on screen: the URL watcher was a hardcoded Tokopedia pattern
- Shopee product pages are recorded: name, image, rating and price come from the JSON-LD Shopee publishes in the page, and the sold count from its `Terjual` label
- Products with variants record the low end of the price range, which is the figure the listing advertises
- The page classifier covers both marketplaces, and the upload path's host allowlist moved into it — it would otherwise have rejected every Shopee product silently
- The popup's page states are no longer Tokopedia-specific, and a Shopee search page honestly reports itself as not trackable
- The popup and the chart modal are in Bahasa Indonesia, including the manifest description and the `id-ID` date format
- The popup header shows "Riwayat Harga" next to the icon, which was previously unlabelled and invisible against the gradient
- Store listing pack added: copy, permission justifications, data disclosure answers, and two 1280×800 screenshots

## [1.1.0] - 2026-10-04
- Firefox builds target MV3 like Chrome, instead of silently falling back to MV2
- Production builds no longer request host permissions for localhost
- CI runs a type check and the test suite, and releases wait for both
- The popup and the price chart modal link to the product's page on pricehistory.id, where tracking and alerts live
- Local price history is capped at 365 points per product and 200 products, newest first
- Prices that fail to upload are queued in `chrome.storage.local` and retried on the next successful upload instead of being dropped
- The popup reports how many prices are waiting to sync
- Corrected README claims about supported marketplaces, storage, install paths, ESLint, and Tailwind
- Removed a dead `zip.sources` option that WXT ignores, and a redundant crosshair unsubscribe call the chart library rejects

## [1.0.0] - 2025-12-10
- `f3c8c1c` release: bump to version 1.0.0
- `aedea9d` fix: github workflow
- `2c9d330` fix: build error
- `f7a4574` fix: resolve critical security and performance issues
- `1e2afbe` fix: exposed credentials
- `4c41418` feat: change url to full url with location.origin
- `4f0d1c7` fix: tokopedia wishlist scraper
- `eab0181` feat: scraping tokopedia is now async and await for specific element instead of using timer
- `25ceb5a` fix: change main function on document complete or interactive else add event listener on DOMContentLoaded
- `4698f66` fix: tokopedia url pattern
- `5b40d9f` chore: update README.md
- `900661d` feat: add github action
- `c226078` feat: migrate to wxt framework

## [0.4.0] - 2025-06-16
- `0a633b7` feat: new logo
- `079b40b` fix: query selector on tokopedia image

## [0.3.0] - 2024-12-16
- `c28a589` feat: finalizes for pricehistory web app
- `41db444` fix: remove url path parameter
- `a410f63` fix: standardize data sent to backend
- `0f47293` feat: refactor repetitive lines
- `84080e0` fix: tokopedia listen on url change on specific url pattern
- `aea8955` fix: remove sync feature (temp)
- `def1eb2` fix: change api endpoint
- `b73a78a` feat: move old script into v1 directory
- `dbcd1e9` fix: linting v2 scripts
- `85ecd3d` feature: add v2 scripts
- `07b7b84` fix: linting inject.js
- `2a5faa6` fix: initiate favorite list element
- `e581fdd` feature: tidy directories part 2
- `b3d1ea6` feature: tidy directories
- `4ad2560` feature: remove https from url
- `5472678` fix: different value same day will create new record
- `aa9c66d` feature: limit max 3 synced items
- `8fc41ee` feature: sync across device with same account
- `0884016` feature: get user info
- `115c245` feature: refactor modal.js
- `fe7ed6c` docs: update README.md

## [0.2.0] - 2024-01-24
- `265c109` feature: brand new tooltips
- `2e182c6` fix: timezone fix and remove unused data from storage
- `18ff7fd` feature: create price trend line

## [0.1.0] - 2024-01-07
- `b4915fb` feature: add average price line
- `dc48d82` feature: update issue templates
- `396fd10` feature: add README.md and screen-record.gif
- `fc42854` feature: add logo
- `0cf8d89` feature: fix price parsing and remove debug output
- `e0b594c` feature: rename extension
- `9018bc9` fix: replace all dot in price
- `a88f98c` feature: box sizing using border-box
- `f7a29fb` feature: add chart
- `c102a37` feature: add logo
