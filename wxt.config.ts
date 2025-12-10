import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'Price History ID',
    manifest_version: 3,
    permissions: ['tabs', 'storage', 'scripting', 'activeTab'],
    host_permissions: [
      '*://*.tokopedia.com/*',
      'https://pricehistory.id/*'
    ],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; connect-src 'self' https://pricehistory.id"
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
        matches: ['*://*.tokopedia.com/*']
      }
    ]
  },
  vite: () => ({
    build: {
      target: 'esnext',
      minify: 'terser'
    }
  }),
  zip: {
    sources: ['!**/*.test.*', '!**/README.md']
  }
});
