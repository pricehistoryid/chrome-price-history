import { ChartManager } from './chart';
import { scrapePDP } from './scraper/tokopedia/pdp';
import { PriceHistory } from './price-history';
import { updateProductPrice } from './api';
import { modalBtn, modal } from './inject'
import { scrapeWishlist } from './scraper/tokopedia/wishlist';
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
  result: ProductData[] | null,
}

// Chart instance created outside
const chart = new ChartManager('chart-container');
window.priceHistoryParam = { chart }; // Make accessible globally if needed

function modalEventListener(modal: HTMLDivElement, modalBtn: HTMLButtonElement) {
  // Show modal
  modalBtn?.addEventListener('click', () => {
    if (modal) modal.style.display = 'block';
  });

  // Close modal on outside click
  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      if (modal) {
        modal.style.display = 'none';
      }
    }
  });
}

async function scrapeTokopedia(url: string): Promise<tokopediaResult> {
  const parsedUrl = new URL(url);
  const path = parsedUrl.pathname;

  // PDP (product detail page)
  if (/^\/[^/]+\/[^/]+-\d+/.test(path)) {
    const result = await scrapePDP(url);
    return {
      pageType: 'pdp',
      result: result ? [result] : null
    };
  }

  // Wishlist
  if (path.startsWith('/wishlist/')) {
    const result = await scrapeWishlist();
    return {
      pageType: 'wishlist',
      result: result
    };
  }

  // // Search page
  // if (parsedUrl.pathname === '/search' || parsedUrl.searchParams.has('q')) {
  // }

  // // Store product page: /{store}/product
  // if (/^\/[^/]+\/product$/.test(path)) {
  // }

  return { pageType: null, result: null };
}

function setupModal() {
  if (!document.body.contains(modalBtn)) {
    document.body.appendChild(modalBtn);
    document.body.appendChild(modal);
    modalEventListener(modal, modalBtn);
  }
}

function teardownModal() {
  modalBtn.remove();
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

        setupModal();
        resetChart(chart);
        ph.save(result.result[0], chart);

        updateProductPrice(result.result[0]);
        break;
      }

      case 'wishlist': {
        teardownModal();
        if (!result.result) return;
        result.result.forEach(product => updateProductPrice(product));
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
