import interact from 'interactjs';
import { createElement } from './utils/dom';

export class FloatingButton {
  private element: HTMLElement;
  private position = { x: 0, y: 0 };
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
    });

    // The button's mark ships with the extension and is exposed to these hosts
    // by `web_accessible_resources`, so it loads with no network request.
    button.style.backgroundImage = `url("${chrome.runtime.getURL('icon/128.png')}")`;

    return button;
  }

  private initDrag() {
    if (this.isDragInitialized) return;
    this.isDragInitialized = true;

    interact(this.element).draggable({
      modifiers: [
        interact.modifiers.restrictRect({
          // CHANGE THIS: 'parent' refers to the full height of the body
          // 'view' refers to the visible viewport
          restriction: 'view',
          endOnly: true,
        }),
      ],
      listeners: {
        move: (event) => {
          // Since we are position: fixed, event.dy (delta Y) is
          // already relative to the screen.
          this.position.y += event.dy;
          this.updatePosition();
          this.element.setAttribute('data-dragged', 'true');
        },
        end: () => {
          this.savePosition();
          setTimeout(() => {
            this.element.removeAttribute('data-dragged');
          }, 100);
        },
      },
    });
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
        // Default to middle of the screen
        this.position.y = (window.innerHeight / 2) - 30;
      }
      this.updatePosition();
    });
  }

  public mount(container: HTMLElement = document.body) {
    container.appendChild(this.element);
    this.initDrag();
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public onClick(callback: () => void) {
    this.element.addEventListener('click', (e) => {
      // Prevent click if it was a drag
      if (this.element.getAttribute('data-dragged') === 'true') {
        return;
      }
      callback();
    });
  }
}
export const floatingButton = new FloatingButton();
