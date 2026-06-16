import { elFactory } from './utils';
import { floatingButton } from './floating-button';

const modalContainer = elFactory(
  'div',
  { class: 'modal-container' },
  elFactory(
    'div',
    { class: 'modal-body' },
    elFactory('div', { class: 'chart', id: 'chart-container' })
  )
);
export const modal = elFactory('div', { class: 'modal' }, modalContainer);

export { floatingButton };
