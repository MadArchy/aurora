import { describe, expect, it } from 'vitest';
import {
  clientDocPath,
  clientSubPath,
  parseStorageRecordingRef,
  storageRecordingPath,
  STORAGE_REF_PREFIX,
} from '../src/services/firestore/paths';

describe('firestore paths', () => {
  it('builds client document paths', () => {
    expect(clientDocPath('client_juan_001')).toBe('clients/client_juan_001');
    expect(clientSubPath('client_juan_001', 'signals', 'sig_1')).toBe('clients/client_juan_001/signals/sig_1');
  });

  it('builds storage recording paths and parses refs', () => {
    const path = storageRecordingPath('org_aurora_01', 'client_juan_001', 'task_1');
    expect(path).toContain('recordings/task_1.webm');
    const ref = `${STORAGE_REF_PREFIX}${path}`;
    expect(parseStorageRecordingRef(ref)).toBe(path);
  });
});
