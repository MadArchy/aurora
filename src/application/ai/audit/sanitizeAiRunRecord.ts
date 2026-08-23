import { SECRET_ERROR_PATTERNS } from '../../../domain/ai/constants';
import type { AiRunPersistenceRecord } from '../ports/outbound/AiRunRepositoryPort';

const FORBIDDEN_FIELD_NAMES = new Set([
  'apiKey',
  'openaiKey',
  'anthropicKey',
  'authorization',
  'rawResponse',
  'outputPayload',
  'systemMessage',
  'userMessage',
  'renderedPrompt',
  'messages',
]);

function sanitizeString(value: string): string {
  let out = value.slice(0, 500);
  for (const pattern of SECRET_ERROR_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }
  if (/OPENAI_API_KEY|ANTHROPIC_API_KEY|Bearer\s+/i.test(out)) {
    out = '[REDACTED]';
  }
  return out;
}

/** Strip secrets and oversized payloads before persistence. */
export function sanitizeAiRunRecord(record: AiRunPersistenceRecord): AiRunPersistenceRecord {
  const sanitized: AiRunPersistenceRecord = {
    ...record,
    errorMessageSanitized: record.errorMessageSanitized
      ? sanitizeString(record.errorMessageSanitized)
      : undefined,
    validationFailureReason: record.validationFailureReason,
  };

  for (const key of FORBIDDEN_FIELD_NAMES) {
    const recordObject = sanitized as unknown as Record<string, unknown>;
    if (key in recordObject) {
      delete recordObject[key];
    }
  }

  return sanitized;
}

export function aiRunRecordContainsSecrets(record: AiRunPersistenceRecord): boolean {
  const blob = JSON.stringify(record);
  const recordObject = record as unknown as Record<string, unknown>;
  return (
    /sk-[a-zA-Z0-9]{10,}/.test(blob) ||
    /Bearer\s+[a-zA-Z0-9._-]+/i.test(blob) ||
    /OPENAI_API_KEY|ANTHROPIC_API_KEY/.test(blob) ||
    [...FORBIDDEN_FIELD_NAMES].some((name) => name in recordObject)
  );
}
