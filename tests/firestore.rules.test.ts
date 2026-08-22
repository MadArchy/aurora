import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'aurora-postura-rules-test';
const ORG_ID = 'org_aurora_01';

describe('firestore.rules (emulator)', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    });
  }, 60_000);

  afterAll(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'clients/client_juan_001'), {
        id: 'client_juan_001',
        organizationId: ORG_ID,
        displayName: 'Juan',
      });
      await setDoc(doc(db, 'clients/client_elena_002'), {
        id: 'client_elena_002',
        organizationId: ORG_ID,
        displayName: 'Elena',
      });
      await setDoc(doc(db, 'clients/client_juan_001/tasks/task_1'), {
        id: 'task_1',
        clientId: 'client_juan_001',
        title: 'Revisar post',
        status: 'ASSIGNED',
      });
      await setDoc(doc(db, 'clients/client_juan_001/deliveries/pkg_1'), {
        id: 'pkg_1',
        clientId: 'client_juan_001',
        status: 'SENT',
        title: 'Briefing',
      });
    });
  });

  it('permite al admin leer cualquier cliente', async () => {
    const adminDb = testEnv
      .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
      .firestore();
    await assertSucceeds(getDoc(doc(adminDb, 'clients/client_juan_001')));
  });

  it('impide que un cliente lea datos de otro cliente', async () => {
    const elenaDb = testEnv
      .authenticatedContext('elena_uid', {
        role: 'CLIENT',
        organizationId: ORG_ID,
        clientId: 'client_elena_002',
      })
      .firestore();
    await assertFails(getDoc(doc(elenaDb, 'clients/client_juan_001/tasks/task_1')));
  });

  it('permite al cliente actualizar su tarea', async () => {
    const juanDb = testEnv
      .authenticatedContext('juan_uid', {
        role: 'CLIENT',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
      })
      .firestore();
    await assertSucceeds(
      updateDoc(doc(juanDb, 'clients/client_juan_001/tasks/task_1'), { status: 'IN_PROGRESS' })
    );
  });

  it('impide al cliente crear señales (solo manager)', async () => {
    const juanDb = testEnv
      .authenticatedContext('juan_uid', {
        role: 'CLIENT',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
      })
      .firestore();
    await assertFails(
      setDoc(doc(juanDb, 'clients/client_juan_001/signals/sig_1'), {
        id: 'sig_1',
        clientId: 'client_juan_001',
        title: 'Intento cliente',
      })
    );
  });

  it('permite ACK de entrega por el cliente', async () => {
    const juanDb = testEnv
      .authenticatedContext('juan_uid', {
        role: 'CLIENT',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
      })
      .firestore();
    await assertSucceeds(
      updateDoc(doc(juanDb, 'clients/client_juan_001/deliveries/pkg_1'), { status: 'ACKNOWLEDGED' })
    );
  });

  it('permite al admin escribir aiRuns del cliente', async () => {
    const adminDb = testEnv
      .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
      .firestore();
    await assertSucceeds(
      setDoc(doc(adminDb, 'clients/client_juan_001/aiRuns/run_1'), {
        id: 'run_1',
        clientId: 'client_juan_001',
        agent: 'TOPIC_AGENT',
        status: 'SUCCESS',
      })
    );
  });

  it('permite al cliente leer aiRuns propios pero no escribirlos', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'clients/client_juan_001/aiRuns/run_1'), {
        id: 'run_1',
        clientId: 'client_juan_001',
        agent: 'TOPIC_AGENT',
        status: 'SUCCESS',
      });
    });

    const juanDb = testEnv
      .authenticatedContext('juan_uid', {
        role: 'CLIENT',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
      })
      .firestore();

    await assertSucceeds(getDoc(doc(juanDb, 'clients/client_juan_001/aiRuns/run_1')));
    await assertFails(
      setDoc(doc(juanDb, 'clients/client_juan_001/aiRuns/run_2'), {
        id: 'run_2',
        clientId: 'client_juan_001',
        agent: 'TOPIC_AGENT',
      })
    );
  });
});
