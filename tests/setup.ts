import { vi } from 'vitest';
vi.stubEnv('VITE_WEB_URL', 'https://pricehistory.id');

const mockStorage = {
  get: vi.fn((keys, callback) => callback({})),
  set: vi.fn(),
};
(global as any).chrome = {
  storage: { local: mockStorage },
  runtime: { getURL: (path: string) => `chrome-extension://test/${path}` },
};
