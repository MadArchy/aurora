/**
 * Aura coach — navega, resalta o señala la zona del paso actual.
 * Solo presentación: no ejecuta reglas de negocio ni envía formularios.
 */

import { publishShellNavigation } from '../../legacy/navigationBridge';

export interface GuideCoachCue {
  /** Pestaña del shell a abrir */
  readonly tab?: string;
  /** data-testid del elemento a resaltar */
  readonly testId?: string;
  /** Selector CSS alternativo */
  readonly selector?: string;
  /** data-tab del menú si el objetivo no aparece */
  readonly navTab?: string;
  /** Texto del faro cuando no se encuentra el objetivo */
  readonly beaconLabel?: string;
  /** Abrir el formulario «+ Nuevo cliente» si existe */
  readonly openCreateClient?: boolean;
  /** Abrir el primer cliente de la lista (si hay) */
  readonly openFirstClient?: boolean;
}

export type CoachApplyResult =
  | { readonly kind: 'highlighted'; readonly label: string }
  | { readonly kind: 'beacon'; readonly label: string }
  | { readonly kind: 'none' };

const TARGET_CLASS = 'guide-aura-target';
const BEACON_ID = 'guide-aura-beacon';
const CALLOUT_ID = 'guide-aura-callout';

let activeTarget: Element | null = null;

function qs(selector: string): Element | null {
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}

function clearDecorations(): void {
  if (activeTarget) {
    activeTarget.classList.remove(TARGET_CLASS);
    activeTarget = null;
  }
  document.getElementById(BEACON_ID)?.remove();
  document.getElementById(CALLOUT_ID)?.remove();
}

function placeCallout(anchor: Element, text: string, mode: 'target' | 'beacon'): void {
  document.getElementById(CALLOUT_ID)?.remove();
  const rect = anchor.getBoundingClientRect();
  const callout = document.createElement('div');
  callout.id = CALLOUT_ID;
  callout.className =
    mode === 'beacon' ? 'guide-aura-callout guide-aura-callout--beacon' : 'guide-aura-callout';
  callout.setAttribute('role', 'status');
  callout.textContent = text;

  const top = Math.max(12, Math.min(window.innerHeight - 72, rect.top + rect.height / 2 - 18));
  const left = Math.min(window.innerWidth - 220, Math.max(12, rect.right + 12));
  callout.style.top = `${top}px`;
  callout.style.left = `${left}px`;
  document.body.appendChild(callout);
}

function highlightElement(el: Element, label: string): CoachApplyResult {
  el.classList.add(TARGET_CLASS);
  activeTarget = el;
  if ('scrollIntoView' in el) {
    (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }
  placeCallout(el, label || 'Mira aquí', 'target');
  return { kind: 'highlighted', label: label || 'Mira aquí' };
}

function showBeacon(navTab: string | undefined, label: string): CoachApplyResult {
  const nav = navTab ? qs(`[data-tab="${navTab}"]`) : null;
  const fallback = qs('.sidebar-nav') ?? qs('.sidebar') ?? document.body;

  if (nav) {
    nav.classList.add(TARGET_CLASS);
    activeTarget = nav;
    placeCallout(nav, label, 'beacon');
  } else if (fallback) {
    placeCallout(fallback, label, 'beacon');
  } else {
    document.getElementById(BEACON_ID)?.remove();
    const beacon = document.createElement('div');
    beacon.id = BEACON_ID;
    beacon.className = 'guide-aura-beacon-float';
    beacon.setAttribute('role', 'status');
    beacon.textContent = label;
    document.body.appendChild(beacon);
  }

  return { kind: 'beacon', label };
}

function resolveTarget(cue: GuideCoachCue): Element | null {
  if (cue.testId) {
    const byTestId = qs(`[data-testid="${cue.testId}"]`);
    if (byTestId) return byTestId;
  }
  if (cue.selector) {
    const bySelector = qs(cue.selector);
    if (bySelector) return bySelector;
  }
  return null;
}

function clickIfPresent(selector: string): boolean {
  const el = qs(selector);
  if (!(el instanceof HTMLElement)) return false;
  el.click();
  return true;
}

/** Limpia resaltados y faros de Aura. */
export function clearGuideCoach(): void {
  clearDecorations();
}

/**
 * Aplica la señal del paso: navega, intenta abrir UI segura, resalta o pone faro.
 */
export async function applyGuideCoach(cue: GuideCoachCue | undefined): Promise<CoachApplyResult> {
  clearDecorations();
  if (!cue) return { kind: 'none' };

  if (cue.tab) {
    publishShellNavigation({ tab: cue.tab });
  }

  // Esperar un frame (y un poco más) a que React pinte la pestaña.
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.setTimeout(() => resolve(), 120);
    });
  });

  if (cue.openCreateClient) {
    clickIfPresent('[data-testid="react-cockpit-create-open"]');
    await new Promise<void>((resolve) => window.setTimeout(() => resolve(), 80));
  }

  if (cue.openFirstClient) {
    const opened = clickIfPresent('[data-testid^="react-cockpit-open-"]');
    if (opened) {
      await new Promise<void>((resolve) => window.setTimeout(() => resolve(), 160));
    }
  }

  const target = resolveTarget(cue);
  const label = cue.beaconLabel || 'Mira aquí';

  if (target) {
    return highlightElement(target, label);
  }

  if (cue.navTab || cue.beaconLabel) {
    return showBeacon(
      cue.navTab,
      cue.beaconLabel ||
        (cue.navTab
          ? `Ve a «${cue.navTab}» en el menú — aún no está visible esa pantalla.`
          : 'Busca esta zona en el menú de la izquierda.')
    );
  }

  return { kind: 'none' };
}
