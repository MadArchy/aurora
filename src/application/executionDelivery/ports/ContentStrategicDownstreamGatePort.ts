import type { StrategicDownstreamAction } from '../../../domain/strategicBriefCore';

export interface ContentStrategicDownstreamGateSuccess {
  ok: true;
  briefId: string;
  version?: number;
  thesisId: string;
  signalIds: string[];
  evidenceIds: string[];
  planId: string;
  planItemId: string;
}

export interface ContentStrategicDownstreamGateFailure {
  ok: false;
  message: string;
}

export type ContentStrategicDownstreamGateResult =
  | ContentStrategicDownstreamGateSuccess
  | ContentStrategicDownstreamGateFailure;

/** SPEC-003 / SPEC-004 downstream gate consumption — not owned here. */
export interface ContentStrategicDownstreamGatePort {
  gate(
    clientId: string,
    briefId: string | undefined,
    action: StrategicDownstreamAction
  ): ContentStrategicDownstreamGateResult;
}
