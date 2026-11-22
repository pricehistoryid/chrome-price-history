import { ChartManager } from './chart';
import { scrapePDP } from './scraper/tokopedia/pdp';
import { scrapeShopeePDP, watchShopeePrice } from './scraper/shopee/pdp';
import { scrapeBlibliPDP, watchBlibliPrice } from './scraper/blibli/pdp';
import { scrapeLazadaPDP, watchLazadaPrice } from './scraper/lazada/pdp';
import { PriceHistory } from './price-history';
import { updateProductPrice, updateProductPrices, getProductPriceHistory } from './api';
import { floatingButton, modal } from './inject';
import { FloatingButton } from './floating-button';
import { scrapeWishlist } from './scraper/tokopedia/wishlist';
import { scrapeSearch } from './scraper/tokopedia/search';
import { ProductData } from './scraper/result';
import { classifyPage, type Marketplace } from '../../../shared/page-url';
import { productPageUrl } from '../../../shared/pricehistory-url';

declare global {
  interface Window {
    priceHistoryParam: {
      chart: ChartManager;
    };
  }
}

type productPageType = 'pdp' | 'wishlist' | 'search';

interface scrapeOutcome {
  pageType: productPageType | null,
  marketplace: Marketplace | null,
  result: ProductData[] | null;
}

/** One scraper per marketplace. Tokopedia's is also the only list scraper. */
const PDP_SCRAPERS: Record<Marketplace, (url: string) => Promise<ProductData | null>> = {
  tokopedia: scrapePDP,
  shopee: scrapeShopeePDP,
  blibli: scrapeBlibliPDP,
  lazada: scrapeLazadaPDP,
};

/** Only the marketplaces whose price moves without a navigation need watching. */
const PRICE_WATCHERS: Partial<Record<Marketplace, (onChange: () => void) => () => void>> = {
  shopee: watchShopeePrice,
  blibli: watchBlibliPrice,
  lazada: watchLazadaPrice,
};

// Chart instance created outside
const chart = new ChartManager('chart-container');
window.priceHistoryParam = { chart }; // Make accessible globally if needed
let accountViewEpoch = 0;

async function showAccountHistory(url: string, ph: PriceHistory, chart: ChartManager): Promise<void> {
  const epoch = accountViewEpoch;
  try {
    const { accountId, prices } = await getProductPriceHistory(url);
    if (epoch !== accountViewEpoch || !accountId || !await ph.mergeRemote(url, prices, accountId)) return;
    if (epoch !== accountViewEpoch || modal.style.display !== 'block' || modal.dataset.productUrl !== url) return;
    chart.clear();
    ph.render(chart, url, accountId);
  } catch (error) {
    console.error('Could not load account price history:', error);
  }
}

function modalEventListener(modal: HTMLDivElement, btn: FloatingButton, ph: PriceHistory) {
  const trigger = btn.getElement();
  let obscured: Element[] = [];
  const close = () => {
    if (modal.style.display !== 'block') return;
    accountViewEpoch += 1;
    modal.style.display = 'none';
    for (const element of obscured) element.removeAttribute('inert');
    obscured = [];
    window.priceHistoryParam.chart.clear();
    trigger.focus();
  };

  btn.onClick(() => {
    accountViewEpoch += 1;
    modal.style.display = 'block';
    obscured = Array.from(document.body.children).filter((element) => element !== modal && !element.hasAttribute('inert'));
    for (const element of obscured) element.setAttribute('inert', '');
    modal.querySelector<HTMLButtonElement>('.ph-modal-close')?.focus();
    modal.querySelector('.modal-content')?.setAttribute('data-loading', 'true');
    const status = modal.querySelector<HTMLElement>('#price-history-status');
    if (status) status.textContent = 'Memuat riwayat harga…';
    window.priceHistoryParam.chart.clear();
    ph.render(window.priceHistoryParam.chart, modal.dataset.productUrl);
    if (modal.dataset.productUrl) void showAccountHistory(modal.dataset.productUrl, ph, window.priceHistoryParam.chart);
  });
  const handleFocus = () => {
    if (modal.style.display !== 'block' || !modal.dataset.productUrl) return;
    accountViewEpoch += 1;
    window.priceHistoryParam.chart.clear();
    ph.render(window.priceHistoryParam.chart, modal.dataset.productUrl);
    void showAccountHistory(modal.dataset.productUrl, ph, window.priceHistoryParam.chart);
  };
  window.addEventListener('focus', handleFocus);
  const hideAccountHistory = () => {
    if (modal.style.display !== 'block') return;
    accountViewEpoch += 1;
    window.priceHistoryParam.chart.clear();
    ph.render(window.priceHistoryParam.chart, modal.dataset.productUrl);
  };
  window.addEventListener('blur', hideAccountHistory);

  window.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });

  const handleEscapeKey = (event: KeyboardEvent) => {
    if (modal.style.display !== 'block') return;
    if (event.key === 'Escape') close();
    if (event.key === 'Tab' && !modal.contains(document.activeElement)) {
      event.preventDefault();
      modal.querySelector<HTMLButtonElement>('.ph-modal-close')?.focus();
      return;
    }
    if (event.key === 'Tab') {
      const controls = Array.from(modal.querySelectorAll<HTMLElement>('button, a[href]'));
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };
  window.addEventListener('keydown', handleEscapeKey);

  // Cleanup on page unload
  const handlePageUnload = () => {
    if (window.priceHistoryParam?.chart) {
      window.priceHistoryParam.chart.destroy();
    }
    window.removeEventListener('keydown', handleEscapeKey);
    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('blur', hideAccountHistory);
  };

  window.addEventListener('beforeunload', handlePageUnload);

  // Listen for spa/navigation changes
  const observer = new MutationObserver(() => {
    // Check if modal is still in DOM
    if (!document.contains(modal)) {
      for (const element of obscured) element.removeAttribute('inert');
      obscured = [];
      handlePageUnload();
      observer.disconnect();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  setupTabListeners(modal, close);
}

export function setupTabListeners(modal: HTMLElement, onClose?: () => void) {
  modal.querySelector('.ph-modal-close')?.addEventListener('click', () => {
    if (onClose) return onClose();
    modal.style.display = 'none';
    window.priceHistoryParam?.chart?.clear();
  });
}

async function scrapePage(url: string): Promise<scrapeOutcome> {
  const page = classifyPage(url);
  const marketplace = page.marketplace;

  switch (page.kind) {
    case 'pdp': {
      const result = await PDP_SCRAPERS[page.marketplace](url);
      return {
        pageType: 'pdp',
        marketplace,
        result: result ? [result] : null,
      };
    }

    // Search and wishlist scraping is Tokopedia-only for now.
    case 'wishlist':
      return page.marketplace === 'tokopedia'
        ? { pageType: 'wishlist', marketplace, result: await scrapeWishlist() }
        : { pageType: null, marketplace, result: null };

    case 'search':
      return page.marketplace === 'tokopedia'
        ? { pageType: 'search', marketplace, result: await scrapeSearch(url) }
        : { pageType: null, marketplace, result: null };

    default:
      return { pageType: null, marketplace, result: null };
  }
}

function setupModal(ph: PriceHistory) {
  if (!document.body.contains(floatingButton.getElement())) {
    floatingButton.mount();
    document.body.appendChild(modal);
    modalEventListener(modal, floatingButton, ph);
  }
}

/** The modal outlives SPA navigation, so this runs on every product page. */
export function pointFooterAtProduct(url: string) {
  const link = modal.querySelector<HTMLAnchorElement>('.modal-footer a');
  if (link) link.href = productPageUrl(url, new URL(import.meta.env.VITE_WEB_URL).origin);
}

function teardownModal() {
  floatingButton.getElement().remove();
  modal.remove();
}


/** Selecting a variant changes no URL, so the page itself has to be watched. */
let priceWatcher: (() => void) | null = null;

function disarmPriceWatcher() {
  priceWatcher?.();
  priceWatcher = null;
}

async function processScraping(
  ph: PriceHistory,
  chart: ChartManager,
  url: string
) {
  disarmPriceWatcher();
  const result = await scrapePage(url);

  switch (result.pageType) {
    case 'pdp': {
      if (!result.result) return;
      const product = result.result[0];
      accountViewEpoch += 1;
      modal.dataset.productUrl = product.url;

      setupModal(ph);
      pointFooterAtProduct(url);
      const name = modal.querySelector<HTMLElement>('#price-history-product');
      if (name) name.textContent = product.name;
      const summary = modal.querySelector<HTMLElement>('#price-history-summary');
      if (summary) summary.hidden = true;
      const chartRegion = modal.querySelector<HTMLElement>('#chart-container');
      if (chartRegion) chartRegion.hidden = true;
      modal.querySelector('.modal-content')?.setAttribute('data-loading', 'true');
      const status = modal.querySelector<HTMLElement>('#price-history-status');
      if (status) status.textContent = 'Memuat riwayat harga…';
      chart.clear();
      // The local observation must finish before merging account history.
      void ph.save(product, { print: (history) => {
        if (modal.dataset.productUrl === product.url) chart.print(history);
      } }).then(() => {
        if (modal.style.display === 'block' && modal.dataset.productUrl === product.url) {
          void showAccountHistory(product.url, ph, chart);
        }
      }).catch((error) => {
        console.error('Error saving price history:', error);
        if (modal.dataset.productUrl !== product.url) return;
        modal.querySelector('.modal-content')?.removeAttribute('data-loading');
        const status = modal.querySelector<HTMLElement>('#price-history-status');
        if (status) status.textContent = 'Riwayat harga tidak dapat disimpan. Muat ulang halaman untuk mencoba lagi.';
      });
      void updateProductPrice(product);

      const watch = result.marketplace ? PRICE_WATCHERS[result.marketplace] : undefined;
      if (watch) {
        priceWatcher = watch(() => {
          void processScraping(ph, chart, `${location.origin}${location.pathname}`);
        });
      }
      break;
    }

    case 'wishlist':
    case 'search': {
      teardownModal();
      if (!result.result) return;
      await ph.saveMany(result.result);
      void updateProductPrices(result.result);
      break;
    }

    default: {
      teardownModal();
      break;
    }
  }
}

export function main() {
  const ph = new PriceHistory();
  const chart = window.priceHistoryParam.chart;

  function handleUrlChange() {
    let url = `${location.origin}${location.pathname}`;
    console.log('[pricehistoryid] URL changed →', url);

    processScraping(ph, chart, url);
  }

  handleUrlChange();

  chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
    if (request.type === 'urlChanged') {
      handleUrlChange();
    }
  });
}
