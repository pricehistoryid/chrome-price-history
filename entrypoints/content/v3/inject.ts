import { createElement } from './utils/dom';
import { floatingButton } from './floating-button';
import { SITE_ORIGIN } from '../../../shared/pricehistory-url';

const tabTrends = createElement('button', { class: 'tab-btn active', 'data-tab': 'trends' }, 'Tren');
const tabContainer = createElement('div', { class: 'tab-container' }, tabTrends);

const chartPane = createElement('div', { class: 'tab-pane active', id: 'chart-container' });
const modalContent = createElement('div', { class: 'modal-content' }, chartPane);

const closeBtn = createElement('div', { class: 'ph-modal-close' }, '×');

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
  { class: 'modal', id: 'price-history-modal' },
  createElement(
    'div',
    { class: 'modal-container' },
    closeBtn,
    tabContainer,
    modalContent,
    modalFooter,
  ),
);

export { floatingButton };
