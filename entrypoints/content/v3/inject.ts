import { createElement } from './utils/dom';
import { floatingButton } from './floating-button';

const modalContainer = createElement(
  'div',
  { class: 'modal-container' },
  createElement('div', { class: 'tab-pane active', id: 'chart-container' }),
);
export const modal = createElement('div', { class: 'modal' }, modalContainer);

export { floatingButton };
