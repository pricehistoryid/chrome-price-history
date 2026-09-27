import { classifyPage } from '../../shared/tokopedia-url';
import { buildProductSummary, findProductRecord } from './product-summary';

type CardState =
  | 'loading'
  | 'pdp-tracked'
  | 'pdp-untracked'
  | 'search'
  | 'wishlist'
  | 'tokopedia-other'
  | 'not-tokopedia'
  | 'error';

// Bound formatters: id-ID emits a non-breaking space after "Rp".
const formatIDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format;

// Stored dates are YYYY-MM-DD; UTC keeps the calendar day stable on any machine.
const formatDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
}).format;

function showState(name: CardState) {
  for (const el of document.querySelectorAll<HTMLElement>('[data-state]')) {
    el.hidden = el.dataset.state !== name;
  }
}

function setField(name: string, text: string) {
  const el = document.querySelector<HTMLElement>(`[data-field="${name}"]`);
  if (el) el.textContent = text;
}

function renderDelta(delta: number | null) {
  const el = document.querySelector<HTMLElement>('[data-field="delta"]');
  if (!el) return;

  if (delta === null || delta === 0) {
    el.hidden = true;
    el.textContent = '';
    return;
  }

  el.hidden = false;
  el.textContent = `${delta < 0 ? '↓' : '↑'} ${formatIDR(Math.abs(delta))}`;
  el.className = `price-delta ${delta < 0 ? 'down' : 'up'}`;
}

export async function render(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const page = classifyPage(tab?.url ?? '');

    if (page.kind !== 'pdp') {
      showState(page.kind);
      return;
    }

    const stored = await chrome.storage.local.get(['price_history']);
    const summary = buildProductSummary(findProductRecord(stored?.price_history, page.productKey));

    if (!summary) {
      showState('pdp-untracked');
      return;
    }

    setField('current', formatIDR(summary.current.price));
    setField('lowest', formatIDR(summary.lowest.price));
    setField(
      'records',
      `${summary.recordCount} records · since ${formatDate(new Date(summary.firstSeen))}`,
    );
    renderDelta(summary.delta);

    showState('pdp-tracked');
  } catch (error) {
    console.error('Popup: could not render price context', error);
    showState('error');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { void render(); });
} else {
  void render();
}
