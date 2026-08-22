import type { Signal } from '../types';
import type { SignalCluster } from './signalClusterCore';
import { hasAnyTerm } from './textMatchCore';

/**
 * "Why Now" responde por qué hablar de esto hoy y no la semana que viene.
 * Sustituye a la heurística por tipo de fuente, que solo sabía si el origen era
 * un regulador pero no si la conversación estaba viva.
 */

export type WhyNowBand = 'NOW' | 'SOON' | 'STALE';

export interface WhyNowContext {
  /** Instante de referencia. Inyectable para que los tests sean deterministas. */
  now?: number;
  /** Piezas que el cliente ya publicó sobre el tema: cada una satura el ángulo. */
  ownPublishedOnTopic?: number;
  /** Señales del mismo tema ya trabajadas o descartadas antes. */
  priorCoverageCount?: number;
}

export interface WhyNowDriver {
  key: 'novelty' | 'velocity' | 'regulatory' | 'mediaWindow';
  label: string;
  /** 0-1. */
  value: number;
  /** Peso del driver en el score final. */
  weight: number;
  phrase: string;
}

export interface WhyNowResult {
  /** 0-1. Entra directo como factor `timeliness` del scoring. */
  score: number;
  score100: number;
  band: WhyNowBand;
  drivers: WhyNowDriver[];
  /** Penalización 0-1 por saturación del ángulo. */
  saturation: number;
  /** Motivo legible para la UI del radar. */
  reason: string;
}

/** Señales de que algo cambió en el marco normativo, no solo que lo publicó un regulador. */
const REGULATORY_CHANGE_TERMS = [
  'guidance',
  'guidelines',
  'final rule',
  'proposed rule',
  'rulemaking',
  'regulation',
  'directive',
  'statute',
  'ruling',
  'enforcement',
  'comment period',
  'effective date',
  'compliance deadline',
  'entra en vigor',
  'reglamento',
  'directriz',
  'sentencia',
  'resolucion',
  'plazo de cumplimiento',
];

const WEIGHTS = {
  novelty: 0.3,
  velocity: 0.25,
  regulatory: 0.25,
  mediaWindow: 0.2,
} as const;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function noveltyFrom(ageHours: number): number {
  if (ageHours <= 6) return 1;
  if (ageHours <= 24) return 0.9;
  if (ageHours <= 48) return 0.75;
  if (ageHours <= 24 * 7) return 0.5;
  if (ageHours <= 24 * 21) return 0.25;
  return 0.1;
}

function agePhrase(ageHours: number): string {
  if (ageHours < 1) return 'detectada hace menos de una hora';
  if (ageHours < 24) return `detectada hace ${Math.round(ageHours)} h`;
  const days = Math.round(ageHours / 24);
  return `detectada hace ${days} día${days === 1 ? '' : 's'}`;
}

/** Ventana mínima de observación: evita ritmos absurdos cuando todo llega a la vez. */
const MIN_OBSERVATION_HOURS = 6;

/** Ritmo al que los medios recogen la historia. */
function clusterVelocity(
  cluster: SignalCluster | undefined,
  now: number
): { value: number; memberCount: number; windowHours: number } {
  if (!cluster || cluster.memberCount <= 1) {
    return { value: 0.15, memberCount: cluster?.memberCount || 1, windowHours: 0 };
  }

  const stamps = cluster.members
    .map((m) => Date.parse(m.detectedAt || ''))
    .filter((t) => Number.isFinite(t));

  const observedHours = stamps.length
    ? Math.max(MIN_OBSERVATION_HOURS, (now - Math.min(...stamps)) / 36e5)
    : 24;

  const sourcesPerDay = cluster.memberCount / (observedHours / 24);
  return {
    value: clamp01(sourcesPerDay / 6),
    memberCount: cluster.memberCount,
    windowHours: Math.round(observedHours),
  };
}

function regulatoryPressure(signal: Signal): { value: number; explicit: boolean } {
  if (signal.sourceType === 'REGULATORY') return { value: 1, explicit: true };
  const text = `${signal.title} ${signal.contentSnippet}`;
  if (hasAnyTerm(text, REGULATORY_CHANGE_TERMS)) return { value: 0.7, explicit: false };
  return { value: 0.15, explicit: false };
}

function bandFor(score: number): WhyNowBand {
  if (score >= 0.7) return 'NOW';
  if (score >= 0.45) return 'SOON';
  return 'STALE';
}

/**
 * Combina novedad, velocidad de conversación, presión regulatoria y ventana
 * mediática, y descuenta la saturación del ángulo.
 */
export function computeWhyNow(
  signal: Signal,
  cluster?: SignalCluster,
  context: WhyNowContext = {}
): WhyNowResult {
  const now = context.now ?? Date.now();
  const detected = Date.parse(signal.detectedAt || '');
  const ageHours = Number.isFinite(detected) ? Math.max(0, (now - detected) / 36e5) : 24 * 30;

  const novelty = noveltyFrom(ageHours);
  const velocity = clusterVelocity(cluster, now);
  const regulatory = regulatoryPressure(signal);
  const outlets = cluster?.alsoIn.length || 0;
  const mediaWindow = clamp01(outlets / 4);

  const drivers: WhyNowDriver[] = [
    {
      key: 'novelty',
      label: 'Novedad',
      value: novelty,
      weight: WEIGHTS.novelty,
      phrase: agePhrase(ageHours),
    },
    {
      key: 'velocity',
      label: 'Velocidad de conversación',
      value: velocity.value,
      weight: WEIGHTS.velocity,
      phrase: velocity.memberCount > 1
        ? `${velocity.memberCount} fuentes en ${velocity.windowHours} h`
        : 'sin tracción en otras fuentes',
    },
    {
      key: 'regulatory',
      label: 'Cambio regulatorio',
      value: regulatory.value,
      weight: WEIGHTS.regulatory,
      phrase: regulatory.explicit
        ? 'publicada por un regulador'
        : regulatory.value > 0.5
          ? 'cambio normativo en el texto'
          : 'sin cambio normativo',
    },
    {
      key: 'mediaWindow',
      label: 'Ventana mediática',
      value: mediaWindow,
      weight: WEIGHTS.mediaWindow,
      phrase: outlets
        ? `${outlets} medio${outlets === 1 ? '' : 's'} adicional${outlets === 1 ? '' : 'es'} ya la cubren`
        : 'ningún otro medio la cubre',
    },
  ];

  const base = drivers.reduce((acc, driver) => acc + driver.value * driver.weight, 0);
  const saturation = clamp01(
    ((context.ownPublishedOnTopic || 0) + (context.priorCoverageCount || 0) * 0.5) / 3
  );
  const score = clamp01(base * (1 - saturation * 0.5));

  const strongest = drivers
    .filter((driver) => driver.value >= 0.5)
    .sort((a, b) => b.value * b.weight - a.value * a.weight)
    .slice(0, 2);

  const reasonParts = strongest.length
    ? strongest.map((driver) => driver.phrase)
    : [drivers[0].phrase, 'sin señales de urgencia'];
  if (saturation >= 0.5) {
    reasonParts.push('ángulo ya saturado por publicaciones propias');
  }

  return {
    score,
    score100: Math.round(score * 100),
    band: bandFor(score),
    drivers,
    saturation,
    reason: reasonParts.join('; '),
  };
}
