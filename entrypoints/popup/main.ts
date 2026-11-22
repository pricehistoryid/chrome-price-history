import { classifyPage } from '../../shared/page-url';
import { productPageUrl } from '../../shared/pricehistory-url';
import { buildProductSummary, findProductRecord } from './product-summary';

type CardState =
  | 'loading'
  | 'pdp-tracked'
  | 'pdp-untracked'
  | 'search'
  | 'wishlist'
  | 'other'
  | 'unsupported'
  | 'error';

// Bound formatters: id-ID emits a non-breaking space after "Rp".
const formatIDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format;

// Stored dates are YYYY-MM-DD; UTC keeps the calendar day stable on any machine.
const formatDate = new Intl.DateTimeFormat('id-ID', {
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

async function renderSyncStatus(): Promise<void> {
  const status = document.querySelector<HTMLElement>('[data-field="sync-status"]');
  const pending = document.querySelector<HTMLElement>('[data-field="pending"]');
  const rejected = document.querySelector<HTMLElement>('[data-field="rejected"]');
  const login = document.querySelector<HTMLElement>('[data-action="login"]');
  if (!status || !pending || !rejected || !login) return;

  status.textContent = 'Mode lokal · status sinkronisasi tidak tersedia';
  pending.hidden = true;
  pending.textContent = '';
  login.hidden = false;
  rejected.hidden = true;
  rejected.textContent = '';

  try {
    const reply: unknown = await chrome.runtime.sendMessage({ type: 'GET_SYNC_STATUS' });
    if (!reply || typeof reply !== 'object' || !('success' in reply) || reply.success !== true || !('authenticated' in reply)) return;
    if (reply.authenticated === false) {
      status.textContent = 'Hanya tersimpan lokal · masuk untuk sinkronisasi';
      return;
    }
    if (reply.authenticated !== true || !('accountId' in reply) || typeof reply.accountId !== 'string' || !reply.accountId ||
      !('pending' in reply) || typeof reply.pending !== 'number' || !Number.isSafeInteger(reply.pending) || reply.pending < 0 ||
      !('rejected' in reply) || typeof reply.rejected !== 'number' || !Number.isSafeInteger(reply.rejected) || reply.rejected < 0) return;

    status.textContent = reply.rejected ? 'Sinkronisasi akun aktif · beberapa harga gagal' : 'Sinkronisasi akun aktif';
    login.hidden = true;
    pending.hidden = reply.pending === 0;
    pending.textContent = reply.pending === 0 ? '' : `${reply.pending} harga menunggu sinkronisasi`;
    rejected.hidden = reply.rejected === 0;
    rejected.textContent = reply.rejected === 0 ? '' : `${reply.rejected} harga tidak dapat disinkronkan. Tetap tersimpan di perangkat ini.`;
  } catch {
    // The popup can still display local price history if the background is unavailable.
  }
}

export async function render(): Promise<void> {
  void renderSyncStatus();
  try {
    const website = new URL(import.meta.env.VITE_WEB_URL).origin;
    const login = document.querySelector<HTMLAnchorElement>('[data-action="login"]');
    if (login) login.href = `${website}/login`;
    const portal = document.querySelector<HTMLAnchorElement>('.btn-portal');
    if (portal) portal.href = website;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const page = classifyPage(tab?.url ?? '');

    if (page.kind !== 'pdp') {
      // Only Tokopedia's list pages are scraped, so a Shopee search page gets
      // the same honest "not trackable" state as a cart or category page.
      const isScrapedList = page.kind === 'search' || page.kind === 'wishlist';
      const state = isScrapedList && page.marketplace !== 'tokopedia' ? 'other' : page.kind;
      showState(state);
      return;
    }

    // Hand off to the app, which is where tracking and price alerts live.
    if (portal) {
      portal.href = productPageUrl(page.productKey, website);
      portal.textContent = 'Buka di PriceHistory.id';
    }

    const stored = await chrome.storage.local.get('price_history');
    const summary = buildProductSummary(findProductRecord(stored?.price_history, page.productKey));

    if (!summary) {
      showState('pdp-untracked');
      return;
    }

    setField('product-name', tab?.title?.trim() || `Produk di ${page.marketplace[0].toUpperCase()}${page.marketplace.slice(1)}`);
    setField('current', formatIDR(summary.current.price));
    setField('lowest', formatIDR(summary.lowest.price));
    setField(
      'records',
      `${summary.recordCount} riwayat harga · sejak ${formatDate(new Date(summary.firstSeen))}`,
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
