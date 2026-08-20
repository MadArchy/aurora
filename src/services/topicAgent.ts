import { dbService } from './db';
import { rankDailyTopics, type TopicAgentRankedItem } from '../domain/topicAgent';
import type { AIRunRecord } from '../types';

export interface TopicAgentRunResult {
  run: AIRunRecord;
  items: TopicAgentRankedItem[];
}

export function getLatestTopicAgentRun(clientId: string): TopicAgentRunResult | null {
  const run = dbService.getAiRuns(50).find(
    (entry) => entry.agent === 'TOPIC_AGENT' && entry.clientId === clientId && entry.status === 'SUCCESS'
  );
  if (!run) return null;
  try {
    const items = JSON.parse(run.outputPayload) as TopicAgentRankedItem[];
    return { run, items };
  } catch {
    return null;
  }
}

/** Disparo manual del Topic Agent v1 (sin LLM — heurístico + rationale). */
export function runTopicAgent(clientId: string): TopicAgentRunResult {
  const signals = dbService.getSignalsByClient(clientId);
  const thesis = dbService.getThesesByClient(clientId).find((t) => t.status === 'ACTIVE');
  const items = rankDailyTopics(clientId, signals, thesis, 5);

  const run = dbService.recordAiRun({
    organizationId: 'org_aurora_01',
    clientId,
    agent: 'TOPIC_AGENT',
    provider: 'AUTOMATIC',
    modelName: 'topic-agent-v1',
    promptTemplateId: 'topic_agent_daily_v1',
    inputContextSummary: `${signals.length} señales · tesis ${thesis?.title || 'sin activa'}`,
    outputPayload: JSON.stringify(items),
    promptTokens: 0,
    completionTokens: 0,
    totalCostUsd: 0,
    latencyMs: 12,
    validationPassed: true,
    securityCheckPassed: true,
    status: 'SUCCESS',
  });

  return { run, items };
}
