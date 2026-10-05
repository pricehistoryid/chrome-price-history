import { ChartManager } from './chart';
import { scrapePDP } from './scraper/tokopedia/pdp';
import { scrapeShopeePDP, watchShopeePrice } from './scraper/shopee/pdp';
import { scrapeBlibliPDP, watchBlibliPrice } from './scraper/blibli/pdp';
import { scrapeLazadaPDP, watchLazadaPrice } from './scraper/lazada/pdp';
import { PriceHistory } from './price-history';
import { updateProductPrice, updateProductPrices } from './api';
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

function modalEventListener(modal: HTMLDivElement, btn: FloatingButton, ph: PriceHistory) {
  // Show modal
  btn.onClick(() => {
    if (modal) {
      modal.style.display = 'block';
      if (!window.priceHistoryParam.chart.isInitialized()) {
        resetChart(window.priceHistoryParam.chart);
        ph.render(window.priceHistoryParam.chart);
      }
    }
  });

  // Close modal on outside click and cleanup
  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      if (modal) {
        modal.style.display = 'none';
        // Clean up chart when modal closes
        if (window.priceHistoryParam?.chart) {
          window.priceHistoryParam.chart.clear();
        }
      }
    }
  });

  // Handle escape key to close modal and cleanup
  const handleEscapeKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && modal.style.display === 'block') {
      modal.style.display = 'none';
      if (window.priceHistoryParam?.chart) {
        window.priceHistoryParam.chart.clear();
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
  };

  window.addEventListener('beforeunload', handlePageUnload);

  // Listen for spa/navigation changes
  const observer = new MutationObserver(() => {
    // Check if modal is still in DOM
    if (!document.contains(modal)) {
      handlePageUnload();
      observer.disconnect();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  setupTabListeners(modal);
}

export function setupTabListeners(modal: HTMLElement) {
  const closeBtn = modal.querySelector('.ph-modal-close');

  closeBtn?.addEventListener('click', () => {
    modal.style.display = 'none';
    if (window.priceHistoryParam?.chart) {
      window.priceHistoryParam.chart.clear();
    }
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
  if (link) link.href = productPageUrl(url);
}

function teardownModal() {
  floatingButton.getElement().remove();
  modal.remove();
}

function resetChart(chart: ChartManager) {
  try {
    chart.clear();
  } catch (error) {
    console.error('Error clearing chart:', error);
  }
  chart.init();
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

      setupModal(ph);
      pointFooterAtProduct(url);
      resetChart(chart);
      // ponytail: fire-and-forget; the promise chain serializes the storage write
      void ph.save(result.result[0], chart).catch((error) => {
        console.error('Error saving price history:', error);
      });
      void updateProductPrice(result.result[0]);

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
