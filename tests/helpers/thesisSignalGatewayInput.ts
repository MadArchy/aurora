import type { ThesisProposalGatewayInput } from '../../src/application/ai/schemas/thesisProposalInput';
import type { SignalThesisEvalGatewayInput } from '../../src/application/ai/schemas/signalThesisEvalInput';
import type { ThesisChallengeGatewayInput } from '../../src/application/ai/schemas/thesisChallengeInput';

export function minimalThesisProposalGatewayInput(
  overrides: Partial<ThesisProposalGatewayInput> = {}
): ThesisProposalGatewayInput {
  return {
    name: 'Dr. Juan Analyst',
    profession: 'AI governance advisor',
    proofPoints: ['ISO audit', 'EU AI Act advisory'],
    compliance: 'No medical claims',
    ...overrides,
  };
}

export function minimalSignalThesisEvalGatewayInput(
  overrides: Partial<SignalThesisEvalGatewayInput> = {}
): SignalThesisEvalGatewayInput {
  return {
    thesisId: 'thesis_1',
    thesisTitle: 'AI governance thesis',
    expertIdentity: 'Dr. Juan Analyst',
    targetAudience: 'CIOs',
    domain: 'AI governance',
    complianceRules: 'No medical claims',
    signalId: 'signal_1',
    signalTitle: 'EU AI Act update',
    signalSourceName: 'Reuters',
    signalSnippet: 'New obligations for high-risk AI systems.',
    ...overrides,
  };
}

export function minimalThesisChallengeGatewayInput(
  overrides: Partial<ThesisChallengeGatewayInput> = {}
): ThesisChallengeGatewayInput {
  return {
    thesisId: 'thesis_1',
    title: 'AI governance thesis',
    expertIdentity: 'Dr. Juan Analyst',
    audience: 'CIOs',
    domain: 'AI governance',
    proofPoints: ['ISO audit'],
    territories: ['Governance'],
    ...overrides,
  };
}
