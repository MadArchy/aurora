import { dbService } from './db';
import { Client, PositioningThesis, Source } from '../types';

export interface SourceSuggestion {
  label: string;
  type: Source['type'];
  nameHint: string;
}

/** Sugerencias de fuentes derivadas de la tesis y el perfil del cliente. */
export function getSourceSuggestions(client: Client, thesis?: PositioningThesis): SourceSuggestion[] {
  const suggestions: SourceSuggestion[] = [];
  const domain = (thesis?.domain || client.profession || '').toLowerCase();
  const profile = dbService.getMasterProfile(client.id);

  if (/legal|derecho|regul|compliance|normativ/i.test(domain)) {
    suggestions.push({
      label: 'Boletines regulatorios del sector',
      type: 'REGULATORY',
      nameHint: 'Boletín regulatorio del sector',
    });
  }
  if (/tech|ia|inteligencia|digital|software/i.test(domain)) {
    suggestions.push({
      label: 'Prensa tech y blogs especializados',
      type: 'RSS',
      nameHint: 'Feed RSS — prensa tech',
    });
  }
  if (/acad|investig|univers|ciencia/i.test(domain)) {
    suggestions.push({
      label: 'Repositorios académicos y journals',
      type: 'ACADEMIC',
      nameHint: 'Journal académico del dominio',
    });
  }
  if (profile?.audience.targetIndustries?.length) {
    const industries = profile.audience.targetIndustries.slice(0, 2).join(' y ');
    suggestions.push({
      label: `Medios de ${industries}`,
      type: 'MEDIA',
      nameHint: `Prensa especializada — ${profile.audience.targetIndustries[0]}`,
    });
  }
  if (thesis?.targetAudience) {
    suggestions.push({
      label: `Temas para: ${thesis.targetAudience.slice(0, 60)}${thesis.targetAudience.length > 60 ? '…' : ''}`,
      type: 'RSS',
      nameHint: 'Feed RSS — audiencia objetivo',
    });
  }
  if (!suggestions.length) {
    suggestions.push(
      {
        label: 'RSS de medios del sector',
        type: 'RSS',
        nameHint: 'Feed RSS del sector',
      },
      {
        label: 'Notas manuales del cliente',
        type: 'MANUAL',
        nameHint: 'Ingesta manual del cliente',
      }
    );
  }
  return suggestions.slice(0, 4);
}
