import type {
  AiRunPersistenceRecord,
  AiRunRepositoryPort,
} from '../src/application/ai/ports/outbound/AiRunRepositoryPort';

export class FakeAiRunRepository implements AiRunRepositoryPort {
  readonly saved: AiRunPersistenceRecord[] = [];
  failNextSave = false;
  saveCallCount = 0;

  async save(run: AiRunPersistenceRecord): Promise<string> {
    this.saveCallCount += 1;
    if (this.failNextSave) {
      this.failNextSave = false;
      throw new Error('Simulated persistence failure');
    }
    this.saved.push(structuredClone(run));
    return run.id;
  }

  last(): AiRunPersistenceRecord | undefined {
    return this.saved.at(-1);
  }

  clear(): void {
    this.saved.length = 0;
    this.saveCallCount = 0;
  }
}
