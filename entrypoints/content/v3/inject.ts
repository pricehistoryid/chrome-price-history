function elFactory<K extends keyof HTMLElementTagNameMap>(
  type: K,
  attributes: { [key: string]: string },
  ...children: (HTMLElement | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(type);

  for (const key in attributes) {
    el.setAttribute(key, attributes[key]);
  }

  children.forEach(child => {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else {
      el.appendChild(child);
    }
  });

  return el;
}

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

export const modalBtn = elFactory('button', { class: 'ph-ext' });
