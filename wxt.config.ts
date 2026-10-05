import { defineConfig } from 'wxt';

// The dashboard on your own machine. Production builds must not ask for
// access to localhost, so these only land in development manifests.
// Must cover VITE_API_URL in .env.development, or the background script cannot
// reach the local API.
const DEV_ORIGINS = ['http://localhost:3000/*', 'http://localhost:3001/*'];
const DEV_CONNECT_SRC = 'ws://localhost:3000 http://localhost:3000 http://localhost:3001';

// See https://wxt.dev/api/config.html
export default defineConfig({
  // Top-level on purpose: `manifest.manifest_version` is ignored by WXT,
  // and Firefox otherwise defaults to MV2 while everything else here is MV3.
  manifestVersion: 3,
  manifest: (env) => {
    const isDev = env.mode === 'development';

    return {
      name: 'Price History ID',
      permissions: ['tabs', 'storage', 'scripting', 'activeTab'],
      host_permissions: [
        '*://*.tokopedia.com/*',
        '*://*.shopee.co.id/*',
        '*://*.blibli.com/*',
        '*://*.lazada.co.id/*',
        'https://pricehistory.id/*',
        ...(isDev ? DEV_ORIGINS : []),
      ],
      content_security_policy: {
        extension_pages: [
          "script-src 'self'",
          "object-src 'self'",
          `connect-src 'self' https://pricehistory.id${isDev ? ` ${DEV_CONNECT_SRC}` : ''}`,
        ].join('; '),
      },
      icons: {
        '16': 'icon/16.png',
        '32': 'icon/32.png',
        '48': 'icon/48.png',
        '128': 'icon/128.png',
      },
      web_accessible_resources: [
        {
          resources: ['icon/*'],
          matches: [
            '*://*.tokopedia.com/*',
            '*://*.shopee.co.id/*',
            '*://*.blibli.com/*',
            '*://*.lazada.co.id/*'
          ]
        }
      ],
      // Firefox MV3 refuses to install without a stable extension ID — confirm
      // it against the AMO listing before submitting, since a mismatch creates a
      // second, empty listing. Since November 2025 AMO requires the
      // data-collection declaration as well: the extension transmits the product
      // pages the user views (websiteActivity) and fields read from them
      // (websiteContent) to pricehistory.id. It collects no technical or usage
      // data, which is why nothing else is listed. Allowed values verified
      // against the addons-linter schema rather than the docs.
      ...(env.browser === 'firefox'
        ? {
            browser_specific_settings: {
              gecko: {
                id: 'pricehistory-id@pricehistory.id',
                data_collection_permissions: {
                  required: ['websiteActivity', 'websiteContent'],
                },
              },
            },
          }
        : {})
    };
  },
  vite: () => ({
    build: {
      target: 'esnext',
      minify: 'terser'
    }
  }),
});
