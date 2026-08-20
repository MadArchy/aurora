import { describe, expect, it } from 'vitest';
import { canQueueForDelivery, deriveWorkStage } from '../src/domain/workPipeline';
import type { CurationEntry, DeliveryPackage, Task } from '../src/types';

function entry(overrides: Partial<CurationEntry> = {}): CurationEntry {
  return {
    id: 'cur_1',
    organizationId: 'org_1',
    clientId: 'client_1',
    title: 'Nueva guía de gobernanza de IA',
    snippet: 'Resumen',
    destination: null,
    managerRationale: '',
    createdAt: new Date().toISOString(),
    createdBy: 'user_admin_01',
    ...overrides,
  };
}

function pkg(overrides: Partial<DeliveryPackage> = {}): DeliveryPackage {
  return {
    id: 'pkg_1',
    organizationId: 'org_1',
    clientId: 'client_1',
    title: 'Briefing de marzo',
    strategicNote: '',
    periodLabel: 'marzo 2026',
    items: [],
    status: 'DRAFT',
    createdAt: new Date().toISOString(),
    createdBy: 'user_admin_01',
    ...overrides,
  };
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task_1',
    organizationId: 'org_1',
    clientId: 'client_1',
    type: 'RECORD_VIDEO',
    title: 'Grabar video',
    description: '',
    estimatedMinutes: 15,
    status: 'ASSIGNED',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('workPipeline', () => {
  it('un ítem sin destino está por decidir', () => {
    expect(deriveWorkStage({ entry: entry() })).toBe('por_decidir');
  });

  it('un ítem descartado no avanza', () => {
    expect(deriveWorkStage({ entry: entry({ destination: 'DISCARD' }) })).toBe('descartado');
  });

  it('decidido sin briefing queda fuera del paquete', () => {
    expect(deriveWorkStage({ entry: entry({ destination: 'TASK_VIDEO' }) })).toBe('decidido');
  });

  it('decidido dentro de un borrador está en el briefing', () => {
    const stage = deriveWorkStage({
      entry: entry({ destination: 'TASK_VIDEO', deliveryPackageId: 'pkg_1' }),
      pkg: pkg(),
    });
    expect(stage).toBe('en_briefing');
  });

  it('paquete enviado marca el ítem como entregado', () => {
    const stage = deriveWorkStage({
      entry: entry({ destination: 'TASK_VIDEO', deliveryPackageId: 'pkg_1' }),
      pkg: pkg({ status: 'SENT' }),
      task: task(),
    });
    expect(stage).toBe('entregado');
  });

  it('la tarea completada cierra el ciclo', () => {
    const stage = deriveWorkStage({
      entry: entry({ destination: 'TASK_VIDEO', deliveryPackageId: 'pkg_1' }),
      pkg: pkg({ status: 'SENT' }),
      task: task({ status: 'COMPLETED' }),
    });
    expect(stage).toBe('completado');
  });

  it('solo se puede encolar lo decidido y aún sin paquete', () => {
    expect(canQueueForDelivery(entry())).toBe(false);
    expect(canQueueForDelivery(entry({ destination: 'DISCARD' }))).toBe(false);
    expect(canQueueForDelivery(entry({ destination: 'TASK_ARTICLE' }))).toBe(true);
    expect(canQueueForDelivery(entry({ destination: 'TASK_ARTICLE', deliveryPackageId: 'pkg_1' }))).toBe(false);
  });
});
