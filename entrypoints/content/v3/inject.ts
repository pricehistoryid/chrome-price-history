import { createElement } from './utils/dom';
import { floatingButton } from './floating-button';
import { SITE_ORIGIN } from '../../../shared/pricehistory-url';

const heading = createElement('h2', { class: 'modal-heading', id: 'price-history-heading' }, 'Riwayat harga');
const productName = createElement('p', { class: 'modal-product', id: 'price-history-product' });
const summary = createElement('dl', { class: 'modal-summary', id: 'price-history-summary', hidden: 'hidden' },
  createElement('div', {}, createElement('dt', {}, 'Harga terakhir'), createElement('dd', { id: 'price-current' })),
  createElement('div', {}, createElement('dt', {}, 'Harga terendah'), createElement('dd', { id: 'price-lowest' })));
const modalContent = createElement('div', { class: 'modal-content', 'data-loading': 'true' },
  createElement('p', { class: 'modal-status', id: 'price-history-status', role: 'status', 'aria-live': 'polite' }, 'Memuat riwayat harga…'),
  createElement('div', { class: 'chart-skeleton', 'aria-hidden': 'true' }),
  createElement('div', { id: 'chart-container', role: 'img', 'aria-label': 'Grafik riwayat harga', hidden: 'hidden' }));

const closeBtn = createElement('button', { class: 'ph-modal-close', type: 'button', 'aria-label': 'Tutup riwayat harga' });

// Alerts and cross-device tracking live in the app, not in this chart.
// The content script points this at the product being viewed.
const modalFooter = createElement(
  'div',
  { class: 'modal-footer' },
  createElement(
    'a',
    { href: SITE_ORIGIN, target: '_blank', rel: 'noopener noreferrer' },
    'Notifikasi harga ada di PriceHistory.id',
  ),
);

export const modal = createElement(
  'div',
  { class: 'modal', id: 'price-history-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'price-history-heading', 'aria-describedby': 'price-history-product price-history-summary', tabindex: '-1' },
  createElement(
    'div',
    { class: 'modal-container' },
    closeBtn,
    heading,
    productName,
    summary,
    modalContent,
    modalFooter,
  ),
);

export { floatingButton };
