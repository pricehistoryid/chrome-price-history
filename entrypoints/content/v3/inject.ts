import { createElement } from './utils/dom';
import { floatingButton } from './floating-button';

const tabTrends = createElement('button', { class: 'tab-btn active', 'data-tab': 'trends' }, 'Trends');
const tabContainer = createElement('div', { class: 'tab-container' }, tabTrends);

const chartPane = createElement('div', { class: 'tab-pane active', id: 'chart-container' });
const modalContent = createElement('div', { class: 'modal-content' }, chartPane);

const closeBtn = createElement('div', { class: 'ph-modal-close' }, '×');

export const modal = createElement(
  'div',
  { class: 'modal', id: 'price-history-modal' },
  createElement(
    'div',
    { class: 'modal-container' },
    closeBtn,
    tabContainer,
    modalContent,
  ),
);

export { floatingButton };
