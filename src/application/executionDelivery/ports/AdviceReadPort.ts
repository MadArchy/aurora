import type { AdviceAction, PositioningAdvice } from '../../../types';

/** Read-only PositioningAdvice dependency — not advisor mutation or AI. */
export interface AdviceReadPort {
  getLatestAdvice(clientId: string): PositioningAdvice | undefined;
  findAdviceAction(
    clientId: string,
    adviceActionId: string
  ): { advice: PositioningAdvice; action: AdviceAction } | undefined;
}
