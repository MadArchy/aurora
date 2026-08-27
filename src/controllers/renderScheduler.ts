/**
 * Coalescing de repintado para la UI legacy.
 *
 * `MainController.render()` reconstruye `#app` por completo. Cada escritura en
 * `dbService` solicita un repintado, y la ingesta automática de fuentes escribe
 * una vez por señal, por SourceRun y por notificación: una ráfaga de escrituras
 * producía un repintado por escritura, perdiendo scroll y foco en cada pasada.
 * Varias peticiones dentro del mismo frame colapsan en un solo repintado.
 *
 * No es autoridad de presentación ni de negocio: solo decide *cuándo* corre un
 * repintado que ya fue solicitado por otro. Nunca decide *qué* se pinta, y no
 * puede suprimir un repintado (un `render()` directo sigue siendo inmediato).
 */
export interface RenderScheduler {
  /** Pide un repintado en el próximo frame. Idempotente dentro del mismo frame. */
  schedule(): void;
  /** Descarta un repintado pendiente, porque ya se está pintando ahora. */
  cancel(): void;
}

export function createRenderScheduler(run: () => void): RenderScheduler {
  let handle: number | null = null;

  return {
    schedule() {
      if (handle !== null) return;
      handle = requestAnimationFrame(() => {
        handle = null;
        run();
      });
    },
    cancel() {
      if (handle === null) return;
      cancelAnimationFrame(handle);
      handle = null;
    },
  };
}
