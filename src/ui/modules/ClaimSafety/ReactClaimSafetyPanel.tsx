/**
 * SPEC-010 · React ClaimSafetyPanel (wave 2, T-010-201).
 *
 * Authority: presentation only, and specifically NOT a publication gate. This
 * panel displays the advisory claim-safety projection; publication is authorized
 * by the canonical SPEC-006 Claim gate (`AuthorizePublication`), never by
 * anything rendered here (threat T-010-14).
 *
 * Reads: NONE — the record arrives as a prop, exactly as in the legacy
 * component. Commands: NONE. "Go to the phrase" is a presentation intent handed
 * to the caller; it moves a cursor and writes nothing.
 *
 * The verdict is rendered as received. This component never recomputes,
 * upgrades, downgrades or overrides a verdict, and never infers one from the
 * findings list.
 */

import type { ClaimSafetyVerdictRecord } from '../../../types';

const VERDICT_LABELS: Record<ClaimSafetyVerdictRecord['verdict'], string> = {
  PASS: 'Revisión advisory OK',
  REVIEW: 'Revisar afirmaciones (advisory)',
  BLOCK: 'Señales de bloqueo (advisory)',
};

const KIND_LABELS: Record<string, string> = {
  CREDENTIAL: 'Cargo o afiliación',
  AWARD: 'Premio o ranking',
  METRIC: 'Cifra',
  SUPERLATIVE: 'Superlativo',
  GUARANTEE: 'Promesa de resultado',
  HARD_BLOCK: 'Límite de la tesis',
};

export function ReactClaimSafetyBadge({ record }: { record?: ClaimSafetyVerdictRecord }) {
  if (!record) return null;
  return (
    <span
      className={`claim-badge claim-badge-${record.verdict.toLowerCase()}`}
      title="Proyección de compatibilidad — la publicación usa el Claim gate canónico"
    >
      {VERDICT_LABELS[record.verdict]}
    </span>
  );
}

export function ReactClaimSafetyPanel({
  record,
  onLocateClaim,
}: {
  record?: ClaimSafetyVerdictRecord;
  /** Presentation intent only: highlight the phrase in the editor. */
  onLocateClaim?: (claim: string) => void;
}) {
  if (!record) {
    return (
      <p className="muted small" data-testid="react-claim-safety-empty">
        Sin proyección advisory de afirmaciones. La publicación se gobierna por el Claim gate
        canónico (SPEC-006).
      </p>
    );
  }

  return (
    <div
      className={`claim-safety-panel claim-safety-${record.verdict.toLowerCase()}`}
      data-testid="react-claim-safety-panel"
      data-authority="ADVISORY_PROJECTION"
    >
      <div className="claim-safety-head">
        <ReactClaimSafetyBadge record={record} />
        <span className="muted small">{record.summary}</span>
      </div>
      <p className="muted small">
        Proyección de compatibilidad — no autoriza publicación por sí sola.
      </p>

      {record.findings.length ? (
        <ul className="claim-finding-list">
          {record.findings.map((finding, index) => {
            const evidenceIds = (finding.supportingEvidenceIds || []).filter(
              (id) => id !== 'thesis:proofPoints'
            );
            return (
              <li
                key={`${finding.kind}-${index}`}
                className={`claim-finding claim-finding-${finding.severity.toLowerCase()}`}
              >
                <div className="claim-finding-head">
                  <strong>{KIND_LABELS[finding.kind] || finding.kind}</strong>
                  <span>{finding.severity === 'BLOCK' ? 'señal fuerte' : 'revisar'}</span>
                </div>
                <p className="claim-finding-quote">“{finding.claim}”</p>
                <p>{finding.detail}</p>
                <p className="claim-finding-action">{finding.action}</p>
                <div className="claim-finding-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => onLocateClaim?.(finding.claim)}
                    disabled={!onLocateClaim}
                  >
                    Ir a la frase
                  </button>
                  {finding.supportingEvidenceIds?.length ? (
                    <span className="muted small">
                      Evidencia: {evidenceIds.length ? evidenceIds.join(', ') : 'proof points de la tesis'}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted small">Sin hallazgos advisory en el texto actual.</p>
      )}
    </div>
  );
}
