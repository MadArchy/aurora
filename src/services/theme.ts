export type ThemeName = 'dark' | 'light';

const STORAGE_KEY = 'postura_theme';

function readStored(): ThemeName | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function prefersLight(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: light)').matches;
}

export const themeService = {
  current(): ThemeName {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
    return readStored() || (prefersLight() ? 'light' : 'dark');
  },

  apply(theme: ThemeName): void {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* almacenamiento no disponible */
    }
  },

  /** Aplica el tema guardado (o el del sistema) antes del primer render. */
  init(): ThemeName {
    const theme = readStored() || (prefersLight() ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    return theme;
  },

  toggle(): ThemeName {
    const next: ThemeName = this.current() === 'light' ? 'dark' : 'light';
    this.apply(next);
    return next;
  },
};
