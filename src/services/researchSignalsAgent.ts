import { dbService } from './db';
import { buildProfileKeywords } from './sourceDiscovery';
import { buildResearchQuery, synthesizeResearchSummary } from '../domain/researchSignalsCore';
import {
  filterTavilyResults,
  searchTavilyWeb,
  type TavilySearchResult,
} from './tavilyDiscovery';
import type {
  AIRunRecord,
  Client,
  PositioningThesis,
  ResearchEvidenceItem,
  Signal,
  SignalResearchBrief,
} from '../types';

export { buildResearchQuery, synthesizeResearchSummary } from '../domain/researchSignalsCore';

export interface ResearchSignalsRunResult {
  run: AIRunRecord;
  briefs: SignalResearchBrief[];
  errors: Array<{ signalId: string; error: string }>;
}

/** Señales que el scoring marcó para investigación adicional. */
export function signalsNeedingResearch(clientId: string): Signal[] {
  return dbService
    .getSignalsByClient(clientId)
    .filter((s) => s.status !== 'DISCARDED' && s.recommendedAction === 'RESEARCH_REQUIRED' && !s.researchBrief);
}

export function getLatestResearchSignalsRun(clientId: string): ResearchSignalsRunResult | null {
  const run = dbService.getAiRuns(40).find(
    (entry) => entry.agent === 'RESEARCH_SIGNALS' && entry.clientId === clientId && entry.status === 'SUCCESS'
  );
  if (!run) return null;
  try {
    const payload = JSON.parse(run.outputPayload) as { briefs?: SignalResearchBrief[]; errors?: ResearchSignalsRunResult['errors'] };
    return { run, briefs: payload.briefs || [], errors: payload.errors || [] };
  } catch {
    return null;
  }
}

function toEvidenceItems(results: TavilySearchResult[]): ResearchEvidenceItem[] {
  return results.slice(0, 5).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: (r.content || r.title).slice(0, 280),
  }));
}

function filterResearchResults(
  results: TavilySearchResult[],
  keywords: import('./sourceDiscovery').ProfileKeywords,
  signal: Signal
): TavilySearchResult[] {
  const profileFiltered = filterTavilyResults(results, keywords);
  if (profileFiltered.length >= 2) return profileFiltered;

  const signalTerms = signal.title.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 4);
  return [...results]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .filter((r) => {
      const blob = `${r.title} ${r.content || ''}`.toLowerCase();
      return signalTerms.some((term) => blob.includes(term));
    })
    .slice(0, 5);
}

export async function runResearchForSignal(
  client: Client,
  signal: Signal,
  thesis: PositioningThesis
): Promise<SignalResearchBrief | { error: string }> {
  const keywords = buildProfileKeywords(client, thesis);
  const query = buildResearchQuery(signal, thesis, keywords);
  const { results, error } = await searchTavilyWeb(query, { max_results: 10, time_range: 'month' });

  if (error) return { error };
  const filtered = filterResearchResults(results, keywords, signal);
  const evidence = toEvidenceItems(filtered);
  const { summary, suggestedNextStep } = synthesizeResearchSummary(signal, thesis, evidence);

  const brief: SignalResearchBrief = {
    queriedAt: new Date().toISOString(),
    query,
    evidence,
    summary,
    suggestedNextStep,
  };

  dbService.applyResearchBriefToSignal(signal.id, brief);
  return brief;
}

/** Agente RESEARCH_SIGNALS: Tavily por señales RESEARCH_REQUIRED (máx. 3 por corrida). */
export async function runResearchSignalsAgent(
  clientId: string,
  options?: { maxSignals?: number; signalId?: string }
): Promise<ResearchSignalsRunResult> {
  const client = dbService.getClientById(clientId);
  if (!client) throw new Error('CLIENT_NOT_FOUND');

  const thesis = dbService.getThesesByClient(clientId).find((t) => t.status === 'ACTIVE');
  if (!thesis) throw new Error('THESIS_REQUIRED');

  const max = options?.maxSignals ?? 3;
  let targets: Signal[];
  if (options?.signalId) {
    const one = dbService.getSignalById(options.signalId);
    targets = one ? [one] : [];
  } else {
    targets = signalsNeedingResearch(clientId).slice(0, max);
  }

  const briefs: SignalResearchBrief[] = [];
  const errors: ResearchSignalsRunResult['errors'] = [];
  const started = Date.now();

  for (const signal of targets) {
    const result = await runResearchForSignal(client, signal, thesis);
    if ('error' in result) {
      errors.push({ signalId: signal.id, error: result.error });
    } else {
      briefs.push(result);
    }
  }

  const run = dbService.recordAiRun({
    organizationId: client.organizationId || 'org_aurora_01',
    clientId,
    agent: 'RESEARCH_SIGNALS',
    provider: 'AUTOMATIC',
    modelName: 'research-signals-tavily-v1',
    promptTemplateId: 'research_signals_v1',
    inputContextSummary: `${targets.length} señal(es) · tesis ${thesis.title}`,
    outputPayload: JSON.stringify({ briefs, errors }),
    promptTokens: 0,
    completionTokens: 0,
    totalCostUsd: 0,
    latencyMs: Date.now() - started,
    validationPassed: true,
    securityCheckPassed: true,
    status: errors.length === targets.length && targets.length > 0 ? 'PROVIDER_ERROR' : 'SUCCESS',
    errorMessage: errors.length ? errors.map((e) => e.error).join('; ') : undefined,
  });

  return { run, briefs, errors };
}
