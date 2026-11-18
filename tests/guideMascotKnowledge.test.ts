import { describe, expect, it } from 'vitest';
import {
  getStep,
  getTour,
  GUIDE_TOURS,
  matchTourFromQuestion,
  stepProgress,
} from '../src/ui/modules/GuideMascot/guideTours';

describe('guide tours', () => {
  it('entiende preguntas de procesos concretos', () => {
    expect(matchTourFromQuestion('como creo un cliente')).toBe('crear-cliente');
    expect(matchTourFromQuestion('como uso el radar')).toBe('radar');
    expect(matchTourFromQuestion('como armo una entrega')).toBe('entregas');
    expect(matchTourFromQuestion('abrir un cliente')).toBe('abrir-cliente');
    expect(matchTourFromQuestion('como publico')).toBe('publicar');
  });

  it('incluye coach de navegación o señal en los recorridos prácticos', () => {
    const practical = ['crear-cliente', 'abrir-cliente', 'radar', 'entregas', 'fuentes', 'publicar'];
    for (const id of practical) {
      const tour = getTour(id);
      expect(tour, id).toBeTruthy();
      expect(tour!.steps.some((step) => Boolean(step.coach)), id).toBe(true);
    }
  });

  it('mantiene lenguaje simple en los tours', () => {
    for (const tour of GUIDE_TOURS) {
      for (const step of tour.steps) {
        expect(step.say).not.toMatch(/\b(rss|api|npm|firestore|localStorage)\b/i);
      }
    }
  });

  it('avanza paso a paso', () => {
    const tour = getTour('crear-cliente');
    expect(tour).toBeTruthy();
    const first = getStep(tour!, tour!.firstStepId);
    expect(first?.choices[0]?.nextStepId).toBe('cc-2');
    expect(stepProgress(tour!, 'cc-2').current).toBe(2);
  });
});
