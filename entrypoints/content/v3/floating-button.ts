import { createElement } from './utils/dom';

export class FloatingButton {
  private element: HTMLElement;
  private position = { y: 0 };
  private STORAGE_KEY = 'floating_button_position';

  private isDragInitialized = false;

  constructor() {
    this.element = this.createElement();
    this.loadPosition();
  }

  private createElement(): HTMLElement {
    const button = createElement('button', {
      class: 'ph-floating-btn',
      id: 'ph-floating-btn',
      type: 'button',
      'aria-label': 'Buka riwayat harga',
    });

    // The button's mark ships with the extension and is exposed to these hosts
    // by `web_accessible_resources`, so it loads with no network request.
    button.style.backgroundImage = `url("${chrome.runtime.getURL('icon/128.png')}")`;

    return button;
  }

  private initDrag() {
    if (this.isDragInitialized) return;
    this.isDragInitialized = true;

    let pointerId: number | null = null;
    let startY = 0;
    let startX = 0;
    let startPosition = 0;
    let dragged = false;
    let suppressClick = false;

    this.element.addEventListener('pointerdown', (event) => {
      if (pointerId !== null || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      pointerId = event.pointerId;
      startY = event.clientY;
      startX = event.clientX;
      startPosition = this.position.y;
      dragged = false;
      suppressClick = false;
      this.element.setPointerCapture(event.pointerId);
    });

    this.element.addEventListener('pointermove', (event) => {
      if (event.pointerId !== pointerId) return;
      const delta = event.clientY - startY;
      if (!dragged && Math.hypot(event.clientX - startX, delta) < 4) return;
      dragged = true;
      const maxY = Math.max(0, window.innerHeight - this.element.getBoundingClientRect().height);
      this.position.y = Math.min(maxY, Math.max(0, startPosition + delta));
      this.updatePosition();
    });

    const finish = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      if (event.type === 'pointercancel') {
        suppressClick = false;
        if (dragged) {
          this.position.y = startPosition;
          this.updatePosition();
        }
      } else if (dragged) {
        suppressClick = true;
        this.savePosition();
      }
      this.element.releasePointerCapture(event.pointerId);
    };
    this.element.addEventListener('pointerup', finish);
    this.element.addEventListener('pointercancel', finish);

    this.element.addEventListener('click', (event) => {
      if (!suppressClick || event.detail === 0) return;
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, { capture: true });
  }

  private updatePosition() {
    this.element.style.top = `${this.position.y}px`;
  }

  private savePosition() {
    chrome.storage.local.set({ [this.STORAGE_KEY]: { y: this.position.y } });
  }

  private loadPosition() {
    chrome.storage.local.get([this.STORAGE_KEY], (result) => {
      if (result[this.STORAGE_KEY]) {
        this.position.y = result[this.STORAGE_KEY].y;
      } else {
        // Start away from the common purchase controls near the page bottom.
        this.position.y = window.innerHeight * 0.2;
      }
      this.position.y = Math.max(0, Math.min(this.position.y, window.innerHeight - 56));
      this.updatePosition();
    });
  }

  public mount(container: HTMLElement = document.body) {
    container.appendChild(this.element);
    if (!this.isDragInitialized) {
      window.addEventListener('resize', () => {
        if (!this.element.isConnected) return;
        this.position.y = Math.max(0, Math.min(this.position.y, window.innerHeight - this.element.getBoundingClientRect().height));
        this.updatePosition();
      });
    }
    this.initDrag();
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public onClick(callback: () => void) {
    this.element.addEventListener('click', () => callback());
  }
}
export const floatingButton = new FloatingButton();
