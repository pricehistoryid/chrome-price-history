import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatingButton } from '../entrypoints/content/v3/floating-button';

const storage = chrome.storage.local;

function pointer(button: HTMLElement, type: string, clientY: number, pointerId = 1, pointerType = 'mouse', clientX = 0) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX, clientY, pointerId, pointerType, button: 0, isPrimary: true });
  button.dispatchEvent(event);
}

function mountedButton() {
  const floatingButton = new FloatingButton();
  floatingButton.mount();
  const button = floatingButton.getElement();
  button.setPointerCapture = vi.fn();
  button.releasePointerCapture = vi.fn();
  button.getBoundingClientRect = vi.fn(() => ({ height: 60 }) as DOMRect);
  return { floatingButton, button };
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
});

describe('FloatingButton', () => {
  it('mounts at the saved position and does not duplicate drag handlers on remount', () => {
    vi.mocked(storage.get as (keys: string[], callback: (items: Record<string, unknown>) => void) => void)
      .mockImplementationOnce((_keys, callback) => callback({ floating_button_position: { y: 100 } }));
    const { floatingButton, button } = mountedButton();
    expect(button.style.top).toBe('100px');
    floatingButton.mount();
    pointer(button, 'pointerdown', 100);
    pointer(button, 'pointermove', 140);
    pointer(button, 'pointerup', 140);
    expect(button.style.top).toBe('140px');
    expect(storage.set).toHaveBeenCalledTimes(1);
  });

  it('keeps a saved launcher reachable when the viewport shrinks', () => {
    vi.mocked(storage.get as (keys: string[], callback: (items: Record<string, unknown>) => void) => void)
      .mockImplementationOnce((_keys, callback) => callback({ floating_button_position: { y: 700 } }));
    const { button } = mountedButton();
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 400 });
    window.dispatchEvent(new Event('resize'));
    expect(parseInt(button.style.top, 10)).toBeLessThanOrEqual(352);
  });

  it.each(['mouse', 'touch'])('drags vertically within the viewport with captured %s pointer and saves on release', (pointerType) => {
    const { button } = mountedButton();
    pointer(button, 'pointerdown', 400, 7, pointerType);
    expect(button.setPointerCapture).toHaveBeenCalledWith(7);
    pointer(button, 'pointermove', 1200, 7, pointerType);
    expect(button.style.top).toBe('740px');
    pointer(button, 'pointerup', 1200, 7, pointerType);
    expect(storage.set).toHaveBeenCalledWith({ floating_button_position: { y: 740 } });
    expect(button.releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it('ignores another pointer and clamps the top of the viewport', () => {
    const { button } = mountedButton();
    pointer(button, 'pointerdown', 400);
    pointer(button, 'pointermove', 0, 2);
    expect(button.style.top).toBe('160px');
    pointer(button, 'pointermove', -100);
    expect(button.style.top).toBe('0px');
    pointer(button, 'pointerup', -100);
    expect(storage.set).toHaveBeenCalledWith({ floating_button_position: { y: 0 } });
  });

  it('suppresses the click after dragging but permits the next click', () => {
    const { floatingButton, button } = mountedButton();
    const onClick = vi.fn();
    floatingButton.onClick(onClick);
    pointer(button, 'pointerdown', 400);
    pointer(button, 'pointermove', 450);
    pointer(button, 'pointerup', 450);
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(onClick).not.toHaveBeenCalled();
    pointer(button, 'pointerdown', 450);
    pointer(button, 'pointerup', 450);
    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(storage.set).toHaveBeenCalledTimes(1);
  });

  it('does not activate after a horizontal drag with no vertical movement', () => {
    const { floatingButton, button } = mountedButton();
    const onClick = vi.fn();
    floatingButton.onClick(onClick);
    pointer(button, 'pointerdown', 400, 1, 'mouse', 100);
    pointer(button, 'pointermove', 400, 1, 'mouse', 140);
    pointer(button, 'pointerup', 400, 1, 'mouse', 140);
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(onClick).not.toHaveBeenCalled();
    expect(storage.set).toHaveBeenCalledWith({ floating_button_position: { y: 160 } });
  });

  it('allows a click without movement and ignores movement after cancellation', () => {
    const { floatingButton, button } = mountedButton();
    const onClick = vi.fn();
    floatingButton.onClick(onClick);
    pointer(button, 'pointerdown', 400, 1, 'touch');
    pointer(button, 'pointercancel', 400, 1, 'touch');
    pointer(button, 'pointermove', 600, 1, 'touch');
    expect(button.style.top).toBe('160px');
    expect(storage.set).not.toHaveBeenCalled();
    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it('reverts a canceled drag without saving and allows the next keyboard activation', () => {
    const { floatingButton, button } = mountedButton();
    const onClick = vi.fn();
    floatingButton.onClick(onClick);
    pointer(button, 'pointerdown', 400, 1, 'touch');
    pointer(button, 'pointermove', 480, 1, 'touch');
    expect(button.style.top).toBe('240px');
    pointer(button, 'pointercancel', 480, 1, 'touch');
    pointer(button, 'pointermove', 600, 1, 'touch');
    expect(button.style.top).toBe('160px');
    expect(storage.set).not.toHaveBeenCalled();
    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('FloatingButton mark', () => {
  it('loads the bundled icon rather than a network URL', () => {
    const fb = new FloatingButton();
    const btn = fb.getElement();

    expect(btn.style.backgroundImage).toContain('chrome-extension://test/icon/128.png');
    expect(btn.style.backgroundImage).not.toContain('http');
  });

  it('opens price history without a visible text label while retaining its accessible name', () => {
    const button = new FloatingButton().getElement();
    expect(button.getAttribute('aria-label')).toMatch(/riwayat harga/i);
    expect(button.textContent).toBe('');
  });
});
