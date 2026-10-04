import { defineConfig } from 'wxt';

// The dashboard on your own machine. Production builds must not ask for
// access to localhost, so these only land in development manifests.
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
          matches: ['*://*.tokopedia.com/*', '*://*.shopee.co.id/*']
        }
      ],
      // Firefox MV3 refuses to install without a stable extension ID. Confirm
      // this against the AMO listing before submitting; a mismatch creates a
      // second, empty listing.
      ...(env.browser === 'firefox'
        ? { browser_specific_settings: { gecko: { id: 'pricehistory-id@pricehistory.id' } } }
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
