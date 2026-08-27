/**
 * Coalescing de repintado (defecto de presentación).
 *
 * Síntoma original: al entrar como ADMIN, `startSourceAutomation()` lanza la
 * ingesta de inmediato; cada escritura en `dbService` emitía un `onChange` que
 * repintaba `#app` completo, así que una ráfaga de escrituras reconstruía la
 * página varias veces por segundo (scroll y foco perdidos en cada pasada).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRenderScheduler } from '../src/controllers/renderScheduler';

describe('createRenderScheduler', () => {
  let frames: Array<() => void>;
  let nextHandle: number;
  let cancelled: number[];

  /** Ejecuta los callbacks encolados, como haría el navegador en el frame. */
  function flushFrame(): void {
    const pending = frames;
    frames = [];
    for (const fn of pending) fn();
  }

  beforeEach(() => {
    frames = [];
    nextHandle = 1;
    cancelled = [];
    vi.stubGlobal('requestAnimationFrame', (fn: () => void) => {
      frames.push(fn);
      return nextHandle++;
    });
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
      cancelled.push(handle);
      frames = [];
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('colapsa una ráfaga de peticiones en un solo repintado', () => {
    const run = vi.fn();
    const scheduler = createRenderScheduler(run);

    // La ingesta de una fuente: señal + SourceRun + notificación + auditoría.
    for (let i = 0; i < 25; i += 1) scheduler.schedule();

    expect(run).not.toHaveBeenCalled();
    flushFrame();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('no suprime repintados de frames posteriores', () => {
    const run = vi.fn();
    const scheduler = createRenderScheduler(run);

    scheduler.schedule();
    flushFrame();
    scheduler.schedule();
    flushFrame();

    expect(run).toHaveBeenCalledTimes(2);
  });

  it('cancel descarta el repintado pendiente', () => {
    const run = vi.fn();
    const scheduler = createRenderScheduler(run);

    scheduler.schedule();
    scheduler.cancel();
    flushFrame();

    expect(run).not.toHaveBeenCalled();
    expect(cancelled).toEqual([1]);
  });

  it('cancel es idempotente y no cancela handles ajenos', () => {
    const scheduler = createRenderScheduler(vi.fn());

    scheduler.cancel();
    scheduler.cancel();

    expect(cancelled).toEqual([]);
  });

  it('vuelve a admitir peticiones después de cancelar', () => {
    const run = vi.fn();
    const scheduler = createRenderScheduler(run);

    scheduler.schedule();
    scheduler.cancel();
    scheduler.schedule();
    flushFrame();

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('un repintado reentrante durante el flush se encola en el frame siguiente', () => {
    const run = vi.fn(() => {
      scheduler.schedule();
    });
    const scheduler = createRenderScheduler(run);

    scheduler.schedule();
    flushFrame();
    expect(run).toHaveBeenCalledTimes(1);

    // Sin liberar el handle antes de ejecutar `run`, esto quedaría bloqueado.
    flushFrame();
    expect(run).toHaveBeenCalledTimes(2);
  });
});
