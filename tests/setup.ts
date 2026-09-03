import { beforeEach, vi } from 'vitest';
import { readLegacyControllerSurface as readLegacyControllerSurfaceImpl } from './lib/legacyControllerSurface';

declare global {
  // eslint-disable-next-line no-var
  var readLegacyControllerSurface: typeof readLegacyControllerSurfaceImpl;
}

globalThis.readLegacyControllerSurface = readLegacyControllerSurfaceImpl;

class LocalStorageMock {
  private store = new Map<string, string>();

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  removeItem(key: string) {
    this.store.delete(key);
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new LocalStorageMock());
});
