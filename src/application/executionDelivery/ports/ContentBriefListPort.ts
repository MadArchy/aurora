import type { StrategicDownstreamAction } from '../../../domain/strategicBriefCore';
import type { StrategicBrief } from '../../../domain/strategicBriefCore';

/** Read-only Brief listing for #33 scientific / recommendation resolution. */
export interface ContentBriefListPort {
  listApprovedBriefs(clientId: string, authorizedAction: StrategicDownstreamAction): StrategicBrief[];
  findApprovedBriefForSignal(params: {
    clientId: string;
    signalId: string;
    action: StrategicDownstreamAction;
  }): StrategicBrief | undefined;
}
