import {
  createAuthorizePublication,
  createExtractClaims,
  createLinkEvidenceToClaim,
  createOverrideClaimGate,
  createRegisterClaim,
  createRejectClaimVerification,
  createRequireEvidence,
  createReviewClaim,
  createVerifyClaim,
  type ClaimExtractorPort,
} from '../../application/claimEvidence';
import {
  createLocalClaimEvidenceStore,
  LocalClaimContentReader,
  LocalClaimHistoryAdapter,
  LocalClaimRepository,
  LocalClaimEvidenceStore,
  LocalEvidenceVaultAdapter,
  LocalEvidenceWriter,
  LocalVerificationStore,
  type ClaimContentSource,
  type EvidenceVaultSource,
} from '../../infrastructure/claimEvidence';

/**
 * Phase 3 composition: wire Application use cases to local-authoritative adapters.
 * Does not hook UI panels, main.ts publication, or legacy claim-safety consumers.
 */
export function composeClaimEvidence(options: {
  content: ClaimContentSource;
  vault?: EvidenceVaultSource;
  store?: LocalClaimEvidenceStore;
  extractor?: ClaimExtractorPort;
}) {
  const store = options.store ?? createLocalClaimEvidenceStore();
  const claims = new LocalClaimRepository(store);
  const history = new LocalClaimHistoryAdapter(store);
  const verifications = new LocalVerificationStore(store);
  const evidence = new LocalEvidenceVaultAdapter(store, options.vault ?? { getById: () => undefined });
  const content = new LocalClaimContentReader(options.content);
  const evidenceWriter = new LocalEvidenceWriter(store);

  const registerDeps = { claims, history, content };
  const verifyDeps = { claims, history, evidence, verifications };
  const linkDeps = { claims, history, evidence };
  const reviewDeps = { claims, history };
  const authorizeDeps = { claims, content, evidence, verifications };

  return {
    store,
    evidenceWriter,
    register: createRegisterClaim(registerDeps),
    extract: createExtractClaims({
      ...registerDeps,
      extractor: options.extractor ?? { extract: () => [] },
    }),
    linkEvidence: createLinkEvidenceToClaim(linkDeps),
    requireEvidence: createRequireEvidence(reviewDeps),
    verify: createVerifyClaim(verifyDeps),
    reject: createRejectClaimVerification(verifyDeps),
    review: createReviewClaim(reviewDeps),
    override: createOverrideClaimGate(reviewDeps),
    authorize: createAuthorizePublication(authorizeDeps),
  };
}
