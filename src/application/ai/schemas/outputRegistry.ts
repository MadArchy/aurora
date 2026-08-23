import type { z } from 'zod';
import type { AiOperation } from '../../../domain/ai/operations';
import type { SchemaIdentity } from '../../../domain/ai/schemaIdentity';
import { isAiOperation } from '../../../domain/ai/operations';
import {
  ContentDraftOutputSchema,
  CONTENT_DRAFT_SCHEMA_ID,
  CONTENT_DRAFT_SCHEMA_VERSION,
  type ContentDraftOutput,
} from './contentDraft';
import {
  ThesisProposalOutputSchema,
  THESIS_PROPOSAL_SCHEMA_ID,
  THESIS_PROPOSAL_SCHEMA_VERSION,
  type ThesisProposalOutput,
} from './thesisProposal';
import {
  SignalThesisEvalOutputSchema,
  SIGNAL_THESIS_EVAL_SCHEMA_ID,
  SIGNAL_THESIS_EVAL_SCHEMA_VERSION,
  type SignalThesisEvalOutput,
} from './signalThesisEval';
import {
  ThesisChallengeOutputSchema,
  THESIS_CHALLENGE_SCHEMA_ID,
  THESIS_CHALLENGE_SCHEMA_VERSION,
  type ThesisChallengeOutput,
} from './thesisChallenge';
import {
  AdvisorPositioningOutputSchema,
  ADVISOR_POSITIONING_SCHEMA_ID,
  ADVISOR_POSITIONING_SCHEMA_VERSION,
  type AdvisorPositioningOutput,
} from './advisorPositioning';
import {
  AdvisorCurationAngleOutputSchema,
  ADVISOR_CURATION_ANGLE_SCHEMA_ID,
  ADVISOR_CURATION_ANGLE_SCHEMA_VERSION,
  type AdvisorCurationAngleOutput,
} from './advisorCurationAngle';
import {
  ComparativeAnalysisOutputSchema,
  ANALYSIS_COMPARATIVE_SCHEMA_ID,
  ANALYSIS_COMPARATIVE_SCHEMA_VERSION,
  type ComparativeAnalysisOutput,
} from './comparativeAnalysis';
import {
  ComparativeAnalysisAggregateSchema,
  type ComparativeAnalysisAggregate,
} from './comparativeAnalysisAggregate';

export interface OperationSchemaDefinition<TOutput> {
  schema: z.ZodType<TOutput>;
  schemaId: string;
  schemaVersion: string;
}

export type AiOperationOutputMap = {
  CONTENT_DRAFT: ContentDraftOutput;
  THESIS_PROPOSAL: ThesisProposalOutput;
  SIGNAL_THESIS_EVAL: SignalThesisEvalOutput;
  THESIS_CHALLENGE: ThesisChallengeOutput;
  ADVISOR_POSITIONING: AdvisorPositioningOutput;
  ADVISOR_CURATION_ANGLE: AdvisorCurationAngleOutput;
  ANALYSIS_COMPARATIVE: ComparativeAnalysisAggregate;
};

const REGISTRY: { [K in AiOperation]: OperationSchemaDefinition<AiOperationOutputMap[K]> } = {
  CONTENT_DRAFT: {
    schema: ContentDraftOutputSchema,
    schemaId: CONTENT_DRAFT_SCHEMA_ID,
    schemaVersion: CONTENT_DRAFT_SCHEMA_VERSION,
  },
  THESIS_PROPOSAL: {
    schema: ThesisProposalOutputSchema,
    schemaId: THESIS_PROPOSAL_SCHEMA_ID,
    schemaVersion: THESIS_PROPOSAL_SCHEMA_VERSION,
  },
  SIGNAL_THESIS_EVAL: {
    schema: SignalThesisEvalOutputSchema,
    schemaId: SIGNAL_THESIS_EVAL_SCHEMA_ID,
    schemaVersion: SIGNAL_THESIS_EVAL_SCHEMA_VERSION,
  },
  THESIS_CHALLENGE: {
    schema: ThesisChallengeOutputSchema,
    schemaId: THESIS_CHALLENGE_SCHEMA_ID,
    schemaVersion: THESIS_CHALLENGE_SCHEMA_VERSION,
  },
  ADVISOR_POSITIONING: {
    schema: AdvisorPositioningOutputSchema,
    schemaId: ADVISOR_POSITIONING_SCHEMA_ID,
    schemaVersion: ADVISOR_POSITIONING_SCHEMA_VERSION,
  },
  ADVISOR_CURATION_ANGLE: {
    schema: AdvisorCurationAngleOutputSchema,
    schemaId: ADVISOR_CURATION_ANGLE_SCHEMA_ID,
    schemaVersion: ADVISOR_CURATION_ANGLE_SCHEMA_VERSION,
  },
  ANALYSIS_COMPARATIVE: {
    /** Operation identity remains analysis.comparative; aggregate is Application-built. */
    schema: ComparativeAnalysisAggregateSchema,
    schemaId: ANALYSIS_COMPARATIVE_SCHEMA_ID,
    schemaVersion: ANALYSIS_COMPARATIVE_SCHEMA_VERSION,
  },
};

/** Per-provider slice schema for multi-provider comparative validation. */
export function resolveComparativeSliceSchema(): OperationSchemaDefinition<ComparativeAnalysisOutput> {
  return {
    schema: ComparativeAnalysisOutputSchema,
    schemaId: ANALYSIS_COMPARATIVE_SCHEMA_ID,
    schemaVersion: ANALYSIS_COMPARATIVE_SCHEMA_VERSION,
  };
}

export function resolveOperationSchema<K extends AiOperation>(
  operation: K
): OperationSchemaDefinition<AiOperationOutputMap[K]> {
  if (!isAiOperation(operation)) {
    throw new Error(`Unsupported operation: ${operation}`);
  }
  return REGISTRY[operation];
}

export function resolveSchemaIdentity(operation: AiOperation): SchemaIdentity {
  const def = resolveOperationSchema(operation);
  return { schemaId: def.schemaId, schemaVersion: def.schemaVersion };
}

export function isOperationSupported(operation: string): operation is AiOperation {
  return isAiOperation(operation);
}
