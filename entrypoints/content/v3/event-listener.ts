import { ChartManager } from './chart';
import { scrapePDP } from './scraper/tokopedia/pdp';
import { PriceHistory } from './price-history';
import { updateProductPrice } from './api';
import { floatingButton, modal } from './inject';
import { FloatingButton } from './floating-button';
import { scrapeWishlist } from './scraper/tokopedia/wishlist';
import { scrapeSearch } from './scraper/tokopedia/search';
import { ProductData } from './scraper/result';

declare global {
  interface Window {
    priceHistoryParam: {
      chart: ChartManager;
    };
  }
}

type tokopediaPageType = 'pdp' | 'wishlist' | 'merchant' | 'search';

interface tokopediaResult {
  pageType: tokopediaPageType | null,
  result: ProductData[] | null;
}

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

async function scrapeTokopedia(url: string): Promise<tokopediaResult> {
  const parsedUrl = new URL(url);
  const path = parsedUrl.pathname;

  // PDP (product detail page)
  if (/^\/[^/]+\/[^/]+-[a-z0-9]+/i.test(path)) {
    const result = await scrapePDP(url);
    return {
      pageType: 'pdp',
      result: result ? [result] : null,
    };
  }

  // Wishlist
  if (path.startsWith('/wishlist/')) {
    const result = await scrapeWishlist();
    return {
      pageType: 'wishlist',
      result: result,
    };
  }

  // Search
  if (path === '/search') {
    console.log('scrape search page')
    const result = await scrapeSearch(url);
    console.log(result)
    return {
      pageType: 'search',
      result: result,
    };
  }

  return { pageType: null, result: null };
}

function setupModal(ph: PriceHistory) {
  if (!document.body.contains(floatingButton.getElement())) {
    floatingButton.mount();
    document.body.appendChild(modal);
    modalEventListener(modal, floatingButton, ph);
  }
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

async function processScraping(
  ph: PriceHistory,
  chart: ChartManager,
  url: string
) {
  if (url.includes('tokopedia')) {
    const result = await scrapeTokopedia(url);

    switch (result.pageType) {
      case 'pdp': {
        if (!result.result) return;

        setupModal(ph);
        resetChart(chart);
        ph.save(result.result[0], chart);

        updateProductPrice(result.result[0]);
        break;
      }

      case 'wishlist':
      case 'search': {
        teardownModal();
        if (!result.result) return;
        result.result.forEach((product) => updateProductPrice(product));
        break;
      }

      default: {
        teardownModal();
        break;
      }
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
