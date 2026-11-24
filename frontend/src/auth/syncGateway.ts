import {
  insertCloudContact,
  insertCloudPracticeProgress,
  insertCloudPublicKey,
  loadCloudSnapshot,
  updateCloudContactIfRevision,
  updateCloudPracticeProgressIfRevision,
  updateCloudPublicKeyIfRevision,
} from '../lib/supabase';
import type { SyncGateway } from './cloudSyncRunner';

export const syncGateway: SyncGateway = {
  load: loadCloudSnapshot,
  insertPublicKey: insertCloudPublicKey,
  updatePublicKey: (accountId, id, revision, value) =>
    updateCloudPublicKeyIfRevision(accountId, id, revision, {
      name: value.name,
      n: value.n,
      e: value.e,
      fingerprint: value.fingerprint,
      deleted_at: value.deleted_at,
    }),
  insertContact: insertCloudContact,
  updateContact: (accountId, id, revision, value) =>
    updateCloudContactIfRevision(accountId, id, revision, {
      name: value.name,
      n: value.n,
      e: value.e,
      fingerprint: value.fingerprint,
      verified: value.verified,
      deleted_at: value.deleted_at,
    }),
  insertPracticeProgress: insertCloudPracticeProgress,
  updatePracticeProgress: updateCloudPracticeProgressIfRevision,
};
