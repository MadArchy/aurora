import type { PositioningThesis } from '../types';

export interface ThesisContextInput {
  clientId: string;
  /** Selección explícita del manager en el workspace. */
  selectedThesisId?: string | null;
  /** Tesis ya atribuida a la entidad (señal, contenido, curación…). */
  entityThesisId?: string | null;
  /** Resolver de tesis primaria del cliente (inyectado para mantener el core puro). */
  getPrimary: (clientId: string) => PositioningThesis | undefined;
  /** Lookup por id dentro del cliente. */
  getById: (clientId: string, thesisId: string) => PositioningThesis | undefined;
}

export interface ThesisContextResult {
  thesis?: PositioningThesis;
  source: 'selected' | 'entity' | 'primary' | 'none';
}

/**
 * Prioridad única en todo el workspace:
 * 1. tesis seleccionada por el manager
 * 2. tesis atribuida a la entidad
 * 3. tesis primaria del cliente
 */
export function resolveThesisContext(input: ThesisContextInput): ThesisContextResult {
  const { clientId, selectedThesisId, entityThesisId, getPrimary, getById } = input;

  if (selectedThesisId) {
    const selected = getById(clientId, selectedThesisId);
    if (selected) return { thesis: selected, source: 'selected' };
  }

  if (entityThesisId) {
    const entity = getById(clientId, entityThesisId);
    if (entity) return { thesis: entity, source: 'entity' };
  }

  const primary = getPrimary(clientId);
  if (primary) return { thesis: primary, source: 'primary' };

  return { source: 'none' };
}

/** Helper tipado para callers que solo necesitan la tesis. */
export function resolveThesis(input: ThesisContextInput): PositioningThesis | undefined {
  return resolveThesisContext(input).thesis;
}
