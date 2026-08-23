import type { PositioningThesis } from '../types';

export interface ThesisContextInput {
  clientId: string;
  /** Selección explícita del manager en el workspace. */
  selectedThesisId?: string | null;
  /** Tesis ya atribuida a la entidad (señal, contenido, curación…). */
  entityThesisId?: string | null;
  /**
   * @deprecated SPEC-001 Phase 4 — primary fallback is PRESENTATION_ONLY.
   * Do not inject for strategic callers. Optional and off by default.
   */
  getPrimary?: (clientId: string) => PositioningThesis | undefined;
  /** When true, allows legacy primary fallback (presentation only). Default false. */
  allowPrimaryFallback?: boolean;
  /** Lookup por id dentro del cliente. */
  getById: (clientId: string, thesisId: string) => PositioningThesis | undefined;
}

export interface ThesisContextResult {
  thesis?: PositioningThesis;
  source: 'selected' | 'entity' | 'primary' | 'none';
}

/**
 * Prioridad:
 * 1. tesis seleccionada por el manager (explícita)
 * 2. tesis atribuida a la entidad (routed / content)
 * 3. primary — ONLY if allowPrimaryFallback (presentation legacy)
 *
 * Strategic callers MUST leave allowPrimaryFallback false/omitted.
 */
export function resolveThesisContext(input: ThesisContextInput): ThesisContextResult {
  const {
    clientId,
    selectedThesisId,
    entityThesisId,
    getPrimary,
    getById,
    allowPrimaryFallback = false,
  } = input;

  if (selectedThesisId) {
    const selected = getById(clientId, selectedThesisId);
    if (selected) return { thesis: selected, source: 'selected' };
  }

  if (entityThesisId) {
    const entity = getById(clientId, entityThesisId);
    if (entity) return { thesis: entity, source: 'entity' };
  }

  if (allowPrimaryFallback && getPrimary) {
    const primary = getPrimary(clientId);
    if (primary) return { thesis: primary, source: 'primary' };
  }

  return { source: 'none' };
}

/** Helper tipado para callers que solo necesitan la tesis. */
export function resolveThesis(input: ThesisContextInput): PositioningThesis | undefined {
  return resolveThesisContext(input).thesis;
}
