# Store listing — Price History ID

Everything a Chrome Web Store (CWS) or Firefox Add-ons (AMO) submission asks for, so submitting is copy-paste rather than a rewrite. The extension UI ships in Bahasa Indonesia only; the English text is for reviewers.

## Facts

| Field | Value |
|---|---|
| Name | Price History ID |
| Version / format | 1.1.0, MV3 on Chrome and Firefox |
| Firefox add-on ID | `pricehistory-id@pricehistory.id` — set in `wxt.config.ts`. Confirm it against the existing AMO listing before submitting; a mismatch creates a second, empty listing. |
| Category | Shopping |
| Homepage | https://pricehistory.id |
| Support and privacy contact | https://github.com/pricehistoryid/chrome-price-history/issues |
| Privacy policy | https://github.com/pricehistoryid/chrome-price-history/blob/main/docs/privacy-policy.md |
| Store package | `.output/pricehistoryid-1.1.0-chrome.zip`, `.output/pricehistoryid-1.1.0-firefox.zip` |

## Short description (CWS limit: 132 characters)

> Riwayat harga produk di Tokopedia, Shopee, Blibli, dan Lazada — harga terbaru, harga terendah, dan tren harga.

## Detailed description (Bahasa Indonesia)

**Riwayat harga di setiap halaman produk Tokopedia, Shopee, Blibli, dan Lazada.**

Buka halaman produk apa pun di keempat marketplace itu dan lihat riwayat harganya: harga terbaru, harga terendah yang pernah tercatat, dan grafik tren harga dengan garis harga rata-rata. Tidak perlu membuka tab lain, tidak perlu akun.

**Yang Anda dapatkan**

- Grafik riwayat harga untuk setiap produk yang Anda buka
- Harga terendah yang pernah tercatat, ditandai langsung di grafik
- Garis harga rata-rata, supaya kelihatan apakah harga sekarang sedang murah
- Tombol ringkas di sisi halaman untuk membuka grafik tanpa mengganggu belanja

**Privasi**

Riwayat harga disimpan di peramban Anda. Harga yang terkumpul juga dikirim ke pricehistory.id agar riwayat produk tetap ada walau Anda berganti perangkat; rincian lengkapnya ada di kebijakan privasi. Tidak ada analitik, tidak ada iklan, dan tidak ada penjualan data.

**Catatan**

Ekstensi ini mendukung halaman produk di Tokopedia, Shopee, Blibli, dan Lazada. Halaman pencarian dan wishlist baru didukung di Tokopedia.

## English summary (for reviewers)

Price History ID shows a price history chart on product pages at Tokopedia, Shopee, Blibli, and Lazada: the current price, the lowest price recorded so far, and an average-price line. Product pages are recorded as you browse; the price points are also sent to pricehistory.id, the operator's own service. No analytics, no ads, no third-party sharing, no remote code.

## Permission justifications

CWS asks for a sentence per permission; paste these.

| Permission | Justification |
|---|---|
| `storage` | Stores the price history shown in the chart, the queued uploads that could not be delivered yet, and the position of the on-page button. Local to the browser. |
| `tabs` | Reads the active tab's URL so the popup and the content script know which product page is open, and notifies the content script when navigation changes the URL. |
| `activeTab`, `scripting` | Runs the price scraper on the product page the user is viewing. |
| `*://*.tokopedia.com/*` | Reads product name, price, image, rating, and units sold from the product, search, and wishlist pages the user opens. |
| `*://*.shopee.co.id/*` | Reads the same fields from Shopee product pages, using the structured data Shopee publishes in the page. |
| `*://*.blibli.com/*` | Reads the same fields from Blibli product pages. |
| `*://*.lazada.co.id/*` | Reads the same fields from Lazada product pages. |
| `https://pricehistory.id/*` | Uploads the collected price points to the operator's own service so price history survives across devices. |

Single purpose statement: *the extension records and displays price history for products on Tokopedia, Shopee, Blibli, and Lazada.*

## Data disclosure

What the extension sends to `pricehistory.id`, per the privacy policy: product URL, product name, product image URL, price, rating, and units sold — over HTTPS, with the extension's own credential. No personally identifying information, no authentication data, no health, financial, location, or communication data, no browsing history beyond the marketplace pages whose prices are read. Nothing is sold or shared with anyone but the operator's service. Collecting this is required for the extension's single purpose; there is no way to use the chart without it.

## Screenshots

Both are 1280×800, the size CWS requires, and show the real build.

| File | Shows |
|---|---|
| `assets/store/screenshot-1-popup.png` | The popup on a tracked product: current price, change, lowest price, record count |
| `assets/store/screenshot-2-chart.png` | The on-page chart modal with the real chart, average and lowest price lines |

To regenerate them after a UI change:

1. `pnpm build`, then copy `.output/chrome-mv3/{popup.html,chunks,icon,content-scripts/content.css}` to a scratch directory.
2. Stub the extension APIs the popup reads, immediately after `<head>` of the copied `popup.html`:
   `globalThis.chrome = { tabs: { query: async () => [{ url: '<a tokopedia product url>' }] }, storage: { local: { get: async () => ({ price_history: { '<same url>': { prevPrice: [...], lowestPrice: {...} } } }) } } }`
3. Build the chart bundle so the modal renders the real chart rather than a drawing:
   `node -e "require('./node_modules/.pnpm/node_modules/esbuild').build({entryPoints:['.chart-shot-entry.ts'],bundle:true,format:'esm',minify:true,outfile:'<scratch>/chart.js'})"`
   where `.chart-shot-entry.ts` imports `ChartManager` from `entrypoints/content/v3/chart` and calls `print()` with a few weeks of prices.
4. Compose each shot as a 1280×800 page: headline, one line of supporting copy, and the UI in an iframe sized to its own **width and** height. An iframe defaults to 300px wide, which silently clips the popup's 320px body on the right — set the width explicitly to 320px.
5. Screenshot at a 1280×800 viewport, then resample to exactly 1280×800 if the browser rendered at a higher device scale (`sips --resampleWidth 1280 in.png --out out.png`).

## Submission checklist

- [ ] Confirm the `/product/<slug>` deep link resolves on the live app — the extension's clickout is the revenue path, and the route was recovered from a January 2025 sitemap capture
- [ ] Confirm `pricehistory.id` is reachable and accepting uploads
- [ ] Privacy policy is public at the URL above
- [ ] AMO: add the `data_collection_permissions` block (current lint notice) and address the `innerHTML` warning in `chart.ts`
- [ ] CWS: developer account, listing text, category, and the two screenshots
- [ ] Bump the version and commit with `release: <version>` to produce the zips and the GitHub release
