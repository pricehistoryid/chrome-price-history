# Privacy Policy — Price History ID (browser extension)

Last updated: 2026-10-03

Draft for store submission. Review the contact section and the "what is sent" list against the deployed API before publishing.

## What stays on your device

The extension uses `chrome.storage.local`, which keeps data on this machine and does not sync through your browser account. Removing the extension deletes it.

| Key | Contents | Why |
|---|---|---|
| `price_history` | For product pages you visit: the product URL, the prices recorded with their dates, and the lowest price seen | Draws the price chart and the popup summary |
| `sync_queue` | Prices that could not be delivered to `pricehistory.id`, kept so they can be retried | Prevents collected prices from being lost |
| `floating_button_position` | The vertical position you dragged the price button to | Keeps the button where you put it |

## What is sent to pricehistory.id

On Shopee product pages, and on Tokopedia product pages, search results, and wishlist pages, the extension uploads the following fields over HTTPS to `https://pricehistory.id/api/v1/price`:

- product URL
- product name
- product image URL
- price
- rating
- number of units sold

Nothing else is transmitted. The extension does not send page content, search terms, cookies, form input, or any account identity. Uploads carry the extension's own API credential, not yours, so they are not tied to a user account — but the product URLs you upload are linked to each other by arrival time.

## What the extension does not do

- No analytics, crash reporting, or advertising SDKs.
- No reading of any page other than Tokopedia product, search, and wishlist pages and Shopee product pages.
- No data shared with anyone other than `pricehistory.id`.
- No affiliate or referral links are generated today.

## Permissions and why they exist

| Permission | Used for |
|---|---|
| `storage` | The local keys above |
| `tabs` | Reading the active tab's URL so the popup and content script know which page you are on |
| `activeTab`, `scripting` | Running the price scraper on the page you are viewing |
| `*://*.tokopedia.com/*` | Reading prices from Tokopedia pages |
| `*://*.shopee.co.id/*` | Reading prices from Shopee product pages |
| `https://pricehistory.id/*` | Uploading collected prices |

## Your choices

- Uninstall the extension to delete everything stored locally.
- There is no account to delete. To request removal of prices uploaded from your browsing, open an issue at https://github.com/pricehistoryid/chrome-price-history/issues and describe the product URLs involved.
