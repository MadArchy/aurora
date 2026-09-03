import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC_ROOT = join(ROOT, 'src');
const SERVER_ROOT = join(ROOT, 'server');

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectTsFiles(full));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      results.push(full);
    }
  }
  return results;
}

function browserReachableFiles(): string[] {
  return collectTsFiles(SRC_ROOT).filter((file) => {
    const rel = relative(SRC_ROOT, file).replace(/\\/g, '/');
    // Server-only infrastructure may live under src/infrastructure — exclude provider adapters.
    if (rel.startsWith('infrastructure/ai/providers/')) return false;
    if (rel.startsWith('infrastructure/ai/configuration/')) return false;
    if (rel.startsWith('infrastructure/ai/persistence/')) return false;
    if (rel.startsWith('composition/')) return false;
    return true;
  });
}

describe('SPEC-005 Phase 5D — negative security / legacy removed', () => {
  it('A: no executable X-AI-Session in browser or server app code', () => {
    const hits: string[] = [];
    for (const file of [...browserReachableFiles(), ...collectTsFiles(SERVER_ROOT)]) {
      const content = readFileSync(file, 'utf8');
      if (/X-AI-Session|x-ai-session/i.test(content)) {
        hits.push(relative(ROOT, file).replace(/\\/g, '/'));
      }
    }
    expect(hits).toEqual([]);
  });

  it('B/C: browser runtime has no provider credential session state APIs', () => {
    const ai = readFileSync(join(SRC_ROOT, 'services/ai.ts'), 'utf8');
    expect(ai).not.toMatch(/setSessionKeys|clearSessionKeys|openAIKey|claudeKey|sessionId|openaiKey|anthropicKey/);
    expect(ai).not.toMatch(/hasActiveSession/);
  });

  it('D: no active browser path calls /api/ai/complete', () => {
    const hits: string[] = [];
    for (const file of browserReachableFiles()) {
      const content = readFileSync(file, 'utf8');
      if (/\/api\/ai\/complete/.test(content)) {
        hits.push(relative(SRC_ROOT, file).replace(/\\/g, '/'));
      }
    }
    expect(hits).toEqual([]);
  });

  it('E/F: no browser-reachable direct provider URLs', () => {
    const hits: string[] = [];
    for (const file of browserReachableFiles()) {
      const content = readFileSync(file, 'utf8');
      if (/api\.openai\.com|api\.anthropic\.com/.test(content)) {
        hits.push(relative(SRC_ROOT, file).replace(/\\/g, '/'));
      }
    }
    expect(hits).toEqual([]);
  });

  it('G: all seven AiOperations use Gateway execution services', () => {
    const ai = readFileSync(join(SRC_ROOT, 'services/ai.ts'), 'utf8');
    const advisor = readFileSync(join(SRC_ROOT, 'services/advisor.ts'), 'utf8');
    expect(ai).toMatch(/executeContentDraftViaGateway/);
    expect(ai).toMatch(/executeThesisProposalViaGateway/);
    expect(ai).toMatch(/executeSignalThesisEvalViaGateway/);
    expect(ai).toMatch(/executeThesisChallengeViaGateway/);
    expect(ai).toMatch(/executeComparativeAnalysisViaGateway/);
    expect(advisor).toMatch(/executeAdvisorPositioningViaGateway/);
    expect(advisor).toMatch(/executeAdvisorCurationAngleViaGateway/);
  });

  it('H: AiCompleteHttpClient never accepts provider API keys', () => {
    const client = readFileSync(join(SRC_ROOT, 'interfaces/ai/aiCompleteHttpClient.ts'), 'utf8');
    expect(client).not.toMatch(/apiKey|openAIKey|claudeKey|X-AI-Session|openaiKey|anthropicKey/i);
    expect(client).toMatch(/getIdToken|Authorization|Bearer/);
  });

  it('legacy agent-json and browser complete helpers removed from ai service', () => {
    const ai = readFileSync(join(SRC_ROOT, 'services/ai.ts'), 'utf8');
    expect(ai).not.toMatch(/\brunAgentJson\b/);
    expect(ai).not.toMatch(/private async complete\b/);
    expect(ai).not.toMatch(/setSessionKeys|clearSessionKeys/);
  });

  it('legacy session-key provider proxy routes removed from postura-api', () => {
    const api = readFileSync(join(SERVER_ROOT, 'postura-api.ts'), 'utf8');
    expect(api).not.toMatch(/url\.startsWith\('\/api\/ai\/complete'\)/);
    expect(api).not.toMatch(/url\.startsWith\('\/api\/ai\/session'\)/);
    expect(api).not.toMatch(/api\.openai\.com|api\.anthropic\.com/);
    expect(api).toMatch(/url\.startsWith\('\/api\/ai\/gateway-complete'\)/);
  });

  it('Manager session-key UI controls removed', () => {
    const cockpit = readFileSync(join(SRC_ROOT, 'components/ManagerCockpit.ts'), 'utf8');
    const main = readLegacyControllerSurface();
    expect(cockpit).not.toMatch(/openai-key-input|claude-key-input|btn-save-ai-keys|ai-provider-select/);
    expect(main).not.toMatch(/btn-save-ai-keys|setSessionKeys|clearSessionKeys/);
  });

  it('server provider adapters still own provider URLs', () => {
    const openai = readFileSync(join(SRC_ROOT, 'infrastructure/ai/providers/OpenAiAdapter.ts'), 'utf8');
    const anthropic = readFileSync(join(SRC_ROOT, 'infrastructure/ai/providers/AnthropicAdapter.ts'), 'utf8');
    expect(openai).toMatch(/api\.openai\.com/);
    expect(anthropic).toMatch(/api\.anthropic\.com/);
  });
});
