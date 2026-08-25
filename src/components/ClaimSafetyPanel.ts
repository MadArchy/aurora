import { esc } from '../lib/escape';
import type { ClaimSafetyVerdictRecord } from '../types';

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

/** Insignia compacta — COMPATIBILITY_ONLY display; not publication authority. */
export function renderClaimSafetyBadge(record?: ClaimSafetyVerdictRecord): string {
  if (!record) return '';
  return `
    <span class="claim-badge claim-badge-${record.verdict.toLowerCase()}" title="Proyección de compatibilidad — la publicación usa el Claim gate canónico">
      ${esc(VERDICT_LABELS[record.verdict])}
    </span>
  `;
}

/**
 * Panel de proyección advisory / COMPATIBILITY_ONLY.
 * No escribe Claim/Verification. La publicación se autoriza vía AuthorizePublication.
 */
export function renderClaimSafetyPanel(record?: ClaimSafetyVerdictRecord): string {
  if (!record) {
    return '<p class="muted small">Sin proyección advisory de afirmaciones. La publicación se gobierna por el Claim gate canónico (SPEC-006).</p>';
  }

  return `
    <div class="claim-safety-panel claim-safety-${record.verdict.toLowerCase()}">
      <div class="claim-safety-head">
        ${renderClaimSafetyBadge(record)}
        <span class="muted small">${esc(record.summary)}</span>
      </div>
      <p class="muted small">Proyección de compatibilidad — no autoriza publicación por sí sola.</p>
      ${record.findings.length
        ? `<ul class="claim-finding-list">
             ${record.findings.map((finding) => `
               <li class="claim-finding claim-finding-${finding.severity.toLowerCase()}">
                 <div class="claim-finding-head">
                   <strong>${esc(KIND_LABELS[finding.kind] || finding.kind)}</strong>
                   <span>${finding.severity === 'BLOCK' ? 'señal fuerte' : 'revisar'}</span>
                 </div>
                 <p class="claim-finding-quote">“${esc(finding.claim)}”</p>
                 <p>${esc(finding.detail)}</p>
                 <p class="claim-finding-action">${esc(finding.action)}</p>
                 <div class="claim-finding-actions">
                   <button type="button" class="btn btn-ghost btn-sm"
                           data-claim-locate="${esc(finding.claim)}">
                     Ir a la frase
                   </button>
                   ${finding.supportingEvidenceIds?.length
                     ? `<span class="muted small">Evidencia: ${finding.supportingEvidenceIds
                         .filter((id) => id !== 'thesis:proofPoints')
                         .map((id) => esc(id))
                         .join(', ') || 'proof points de la tesis'}</span>`
                     : ''}
                 </div>
               </li>
             `).join('')}
           </ul>`
        : '<p class="muted small">Sin hallazgos advisory en el texto actual.</p>'}
    </div>
  `;
}
