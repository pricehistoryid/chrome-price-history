import { describe, it, expect, vi, beforeAll } from 'vitest';
import { modal } from '../entrypoints/content/v3/inject';
import { setupTabListeners } from '../entrypoints/content/v3/event-listener';

beforeAll(() => {
  const mockStorage = {
    get: vi.fn((keys, callback) => callback({})),
    set: vi.fn(),
  };
  (global as any).chrome = { storage: { local: mockStorage } };
  
  // Initialize listeners for testing
  setupTabListeners(modal as HTMLDivElement);
});

describe('Modal Structure', () => {
  it('should have a tab-container with one button: Trends', () => {
    const tabContainer = modal.querySelector('.tab-container');
    expect(tabContainer).not.toBeNull();

    const buttons = tabContainer?.querySelectorAll('button');
    expect(buttons?.length).toBe(1);
    expect(buttons?.[0].textContent).toBe('Trends');
  });

  it('should have a content-container with one tab-pane: chart-container', () => {
    const contentContainer = modal.querySelector('.modal-content');
    expect(contentContainer).not.toBeNull();

    const panes = contentContainer?.querySelectorAll('.tab-pane');
    expect(panes?.length).toBe(1);
    expect(panes?.[0].id).toBe('chart-container');
  });
});

describe('Modal Functionality', () => {
  it('should hide modal when clicking close button', () => {
    const closeBtn = modal.querySelector('.ph-modal-close') as HTMLElement;
    modal.style.display = 'block';
    
    closeBtn.click();
    expect(modal.style.display).toBe('none');
  });
});
