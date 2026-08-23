import { UnimplementedAiGateway } from '../../application/ai/use-cases/UnimplementedAiGateway';
import type { AiGatewayPort } from '../../application/ai/ports/inbound/AiGatewayPort';

/** Deterministic test composition root — no live infrastructure. */
export function createTestAiGateway(): AiGatewayPort {
  return new UnimplementedAiGateway();
}
