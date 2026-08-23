import { MAX_REPAIR_ATTEMPTS } from '../../../domain/ai/constants';
import type { ValidationStatus } from '../../../domain/ai/validationState';
import { validateAiOutput, type ValidateAiOutputResult } from './validateOutput';
import type { z } from 'zod';

export interface ValidationPipelineState<T> {
  status: ValidationStatus;
  repairCount: number;
  result?: ValidateAiOutputResult<T>;
}

export function runValidationPipeline<T>(params: {
  raw: string;
  schema: z.ZodType<T>;
  attemptRepair?: (issues: { path: string; message: string }[]) => string | null;
}): ValidationPipelineState<T> {
  let repairCount = 0;
  let currentRaw = params.raw;

  while (true) {
    const result = validateAiOutput({ raw: currentRaw, schema: params.schema });
    if (result.status === 'VALID') {
      return { status: 'VALID', repairCount, result };
    }

    if (repairCount >= MAX_REPAIR_ATTEMPTS) {
      return { status: 'REJECTED', repairCount, result };
    }

    if (!params.attemptRepair) {
      return { status: 'REPAIR_REQUIRED', repairCount, result };
    }

    const repairedRaw = params.attemptRepair(result.issues);
    if (!repairedRaw) {
      return { status: 'REJECTED', repairCount, result };
    }

    repairCount += 1;
    currentRaw = repairedRaw;
  }
}

export function canAttemptRepair(repairCount: number): boolean {
  return repairCount < MAX_REPAIR_ATTEMPTS;
}
