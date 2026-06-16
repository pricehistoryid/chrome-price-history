import { describe, it, expect, vi, beforeAll } from 'vitest';
import { FloatingButton } from '../entrypoints/content/v3/floating-button';

beforeAll(() => {
  const mockStorage = {
    get: vi.fn((keys, callback) => callback({})),
    set: vi.fn(),
  };
  (global as any).chrome = { storage: { local: mockStorage } };
  
  // Mock window properties
  (window as any).innerHeight = 800;
});

describe('FloatingButton', () => {
  it('should handle dragging', () => {
    const fb = new FloatingButton();
    fb.mount();
    const btn = fb.getElement();
    
    // Initial position: 800/2 - 30 = 370
    expect(btn.style.top).toBe('370px');
  });

  it('should maintain position when dragged with scroll', () => {
    const fb = new FloatingButton();
    fb.mount();
    const btn = fb.getElement();
    
    // Simulate drag: y += 50
    (fb as any).position.y += 50;
    (fb as any).updatePosition();

    expect(btn.style.top).toBe('420px');
  });
});
