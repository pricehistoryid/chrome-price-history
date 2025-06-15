import { ChartManager } from './chart';
import { scrapePDP } from './scraper/tokopedia/pdp'; // Assuming you have this
import { PriceHistory } from './price-history'; // Assuming you have this
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

type tokopediaPageType = 'pdp' | 'wishlist' | 'storeProduct' | 'search';

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

function scrapeTokopedia(url: string): tokopediaResult {
  const parsedUrl = new URL(`https://${url}`);
  const path = parsedUrl.pathname;
  console.log(path);

  // PDP (product detail page)
  if (/^\/[^/]+\/[^/]+-\d+/.test(path)) {
    const result = scrapePDP(url);
    return {
      pageType: 'pdp',
      result: result ? [result] : null
    };
  }

  // Wishlist
  if (path.startsWith('/wishlist/')) {
    const result = scrapeWishlist();
    return {pageType: 'wishlist', result};
  }

  // // Search page
  // if (parsedUrl.pathname === '/search' || parsedUrl.searchParams.has('q')) {
  // }

  // // Store product page: /{store}/product
  // if (/^\/[^/]+\/product$/.test(path)) {
  // }

  return {pageType: null, result: null};
}

function processScraping(
  ph: PriceHistory,
  chart: ChartManager,
  timer: NodeJS.Timeout,
  url: string
) {
  if (url.includes('tokopedia')) {
    console.log('scrape tokopedia');
    // need to detect tokopedia url type (PDP, search, merchant, etc) -> if there's product price then scrape and clearInterval
    const result = scrapeTokopedia(url);
    console.log(result);

    if (result.pageType == 'pdp' && result.result) {
      document.body.appendChild(modalBtn);
      document.body.appendChild(modal);

      modalEventListener(modal, modalBtn);
      try {
        chart.clear();
      } catch (error) {
        console.error('Error clearing chart:', error);
      }
      chart.init();
      ph.save(result.result[0], chart);

      updateProductPrice(result.result[0]);
    } else {
      modalBtn.remove();
      modal.remove();
    }

    if (result.pageType == 'wishlist' && result.result) {
      result.result.forEach(product => {
        updateProductPrice(product);
      });
    }
  }
  clearInterval(timer);
}

export function main() {
  const ph = new PriceHistory();
  const chart = window.priceHistoryParam.chart;

  let url = `${location.host}${location.pathname}`;
  let timer = setInterval(afterLoad, import.meta.env.WXT_REFRESH_INTERVAL);

  function afterLoad() {
    processScraping(ph, chart, timer, url);
  }

  chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
    if (request.type === 'urlChanged') {
      url = `${location.host}${location.pathname}`;
      console.log(url);
      timer = setInterval(afterLoad, import.meta.env.WXT_REFRESH_INTERVAL);
    }
  });
}
