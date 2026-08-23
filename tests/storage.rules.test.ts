import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteObject,
  getDownloadURL,
  ref,
  updateMetadata,
  uploadBytes,
} from 'firebase/storage';
import { RECORDING_MAX_BYTES } from '../src/domain/recordingLimits';

const PROJECT_ID = 'aurora-postura-storage-rules-test';
const ORG_ID = 'org_aurora_01';
const OTHER_ORG = 'org_other_99';
const CLIENT_ID = 'client_juan_001';
const OTHER_CLIENT = 'client_elena_002';

function recordingPath(orgId: string, clientId: string, taskId = 'task_1'): string {
  return `organizations/${orgId}/clients/${clientId}/recordings/${taskId}.webm`;
}

function webmBlob(bytes: number): Blob {
  return new Blob([new Uint8Array(Math.max(1, bytes))], { type: 'video/webm' });
}

describe('storage.rules (emulator) — SPEC-009 Phase 3', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      storage: {
        rules: readFileSync(resolve(process.cwd(), 'storage.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 9199,
      },
    });
  }, 60_000);

  afterAll(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearStorage();
  });

  function juanStorage() {
    return testEnv
      .authenticatedContext('juan_uid', {
        role: 'CLIENT',
        organizationId: ORG_ID,
        clientId: CLIENT_ID,
      })
      .storage();
  }

  function elenaStorage() {
    return testEnv
      .authenticatedContext('elena_uid', {
        role: 'CLIENT',
        organizationId: ORG_ID,
        clientId: OTHER_CLIENT,
      })
      .storage();
  }

  function adminStorage() {
    return testEnv
      .authenticatedContext('admin_uid', {
        role: 'ADMIN',
        organizationId: ORG_ID,
      })
      .storage();
  }

  function otherOrgAdminStorage() {
    return testEnv
      .authenticatedContext('admin_other', {
        role: 'ADMIN',
        organizationId: OTHER_ORG,
      })
      .storage();
  }

  it('unauthenticated upload DENY', async () => {
    const storage = testEnv.unauthenticatedContext().storage();
    await assertFails(
      uploadBytes(ref(storage, recordingPath(ORG_ID, CLIENT_ID)), webmBlob(64), {
        contentType: 'video/webm',
      })
    );
  });

  it('unauthenticated read DENY', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), recordingPath(ORG_ID, CLIENT_ID)), webmBlob(64), {
        contentType: 'video/webm',
      });
    });
    const storage = testEnv.unauthenticatedContext().storage();
    await assertFails(getDownloadURL(ref(storage, recordingPath(ORG_ID, CLIENT_ID))));
  });

  it('CLIENT own-org own-client valid WebM upload ALLOW', async () => {
    await assertSucceeds(
      uploadBytes(ref(juanStorage(), recordingPath(ORG_ID, CLIENT_ID)), webmBlob(128), {
        contentType: 'video/webm',
      })
    );
  });

  it('CLIENT other client upload DENY', async () => {
    await assertFails(
      uploadBytes(ref(juanStorage(), recordingPath(ORG_ID, OTHER_CLIENT)), webmBlob(64), {
        contentType: 'video/webm',
      })
    );
  });

  it('CLIENT cross-org upload DENY', async () => {
    await assertFails(
      uploadBytes(ref(juanStorage(), recordingPath(OTHER_ORG, CLIENT_ID)), webmBlob(64), {
        contentType: 'video/webm',
      })
    );
  });

  it('ADMIN same-org upload and read ALLOW', async () => {
    const path = recordingPath(ORG_ID, CLIENT_ID, 'task_admin');
    await assertSucceeds(
      uploadBytes(ref(adminStorage(), path), webmBlob(96), { contentType: 'video/webm' })
    );
    await assertSucceeds(getDownloadURL(ref(adminStorage(), path)));
  });

  it('ADMIN cross-org action DENY', async () => {
    await assertFails(
      uploadBytes(ref(adminStorage(), recordingPath(OTHER_ORG, CLIENT_ID)), webmBlob(64), {
        contentType: 'video/webm',
      })
    );
    await assertFails(
      uploadBytes(ref(otherOrgAdminStorage(), recordingPath(ORG_ID, CLIENT_ID)), webmBlob(64), {
        contentType: 'video/webm',
      })
    );
  });

  it('invalid MIME upload DENY', async () => {
    await assertFails(
      uploadBytes(ref(juanStorage(), recordingPath(ORG_ID, CLIENT_ID, 'bad_mime')), webmBlob(64), {
        contentType: 'video/mp4',
      })
    );
    await assertFails(
      uploadBytes(ref(juanStorage(), recordingPath(ORG_ID, CLIENT_ID, 'octet')), webmBlob(64), {
        contentType: 'application/octet-stream',
      })
    );
  });

  it('valid WebM MIME with codecs ALLOW', async () => {
    await assertSucceeds(
      uploadBytes(ref(juanStorage(), recordingPath(ORG_ID, CLIENT_ID, 'codecs')), webmBlob(64), {
        contentType: 'video/webm;codecs=vp9,opus',
      })
    );
  });

  it('file exactly within size limit ALLOW', async () => {
    await assertSucceeds(
      uploadBytes(
        ref(juanStorage(), recordingPath(ORG_ID, CLIENT_ID, 'within')),
        webmBlob(1024),
        { contentType: 'video/webm' }
      )
    );
  });

  it('file above size limit DENY', async () => {
    await assertFails(
      uploadBytes(
        ref(juanStorage(), recordingPath(ORG_ID, CLIENT_ID, 'too_big')),
        webmBlob(RECORDING_MAX_BYTES + 1),
        { contentType: 'video/webm' }
      )
    );
  }, 120_000);

  it('CLIENT own recording read ALLOW', async () => {
    const path = recordingPath(ORG_ID, CLIENT_ID, 'read_own');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), path), webmBlob(64), { contentType: 'video/webm' });
    });
    await assertSucceeds(getDownloadURL(ref(juanStorage(), path)));
  });

  it('CLIENT other-client recording read DENY', async () => {
    const path = recordingPath(ORG_ID, CLIENT_ID, 'read_other');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), path), webmBlob(64), { contentType: 'video/webm' });
    });
    await assertFails(getDownloadURL(ref(elenaStorage(), path)));
  });

  it('cross-org read DENY', async () => {
    const path = recordingPath(ORG_ID, CLIENT_ID, 'read_cross');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), path), webmBlob(64), { contentType: 'video/webm' });
    });
    await assertFails(getDownloadURL(ref(otherOrgAdminStorage(), path)));
  });

  it('allowed delete ALLOW', async () => {
    const path = recordingPath(ORG_ID, CLIENT_ID, 'del_ok');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), path), webmBlob(64), { contentType: 'video/webm' });
    });
    await assertSucceeds(deleteObject(ref(juanStorage(), path)));
  });

  it('unauthorized delete DENY', async () => {
    const path = recordingPath(ORG_ID, CLIENT_ID, 'del_deny');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), path), webmBlob(64), { contentType: 'video/webm' });
    });
    await assertFails(deleteObject(ref(elenaStorage(), path)));
  });

  it('metadata update DENY', async () => {
    const path = recordingPath(ORG_ID, CLIENT_ID, 'meta');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), path), webmBlob(64), { contentType: 'video/webm' });
    });
    await assertFails(
      updateMetadata(ref(juanStorage(), path), {
        contentType: 'video/webm',
        customMetadata: { note: 'nope' },
      })
    );
  });

  it('arbitrary path outside approved recordings hierarchy DENY', async () => {
    await assertFails(
      uploadBytes(ref(juanStorage(), `clients/${CLIENT_ID}/recordings/task_1.webm`), webmBlob(64), {
        contentType: 'video/webm',
      })
    );
    await assertFails(
      uploadBytes(
        ref(juanStorage(), `organizations/${ORG_ID}/clients/${CLIENT_ID}/avatars/pic.png`),
        webmBlob(64),
        { contentType: 'image/png' }
      )
    );
  });
});
