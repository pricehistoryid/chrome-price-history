import { vi } from 'vitest';

const mockStorage = {
  get: vi.fn((keys, callback) => callback({})),
  set: vi.fn(),
};
(global as any).chrome = {
  storage: { local: mockStorage },
  runtime: { getURL: (path: string) => `chrome-extension://test/${path}` },
};
