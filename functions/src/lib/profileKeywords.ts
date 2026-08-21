import type { ProfileKeywords } from './ingestGate';

interface ClientLike {
  id: string;
  profession?: string;
}

interface ThesisLike {
  domain?: string;
  title?: string;
  expertIdentity?: string;
  status?: string;
}

interface ProfileLike {
  career?: { industries?: string[] };
  audience?: { targetIndustries?: string[] };
  voicePreferences?: { topicsToAvoid?: string[] };
}

interface DossierLike {
  topicsToOwn?: string[];
  topicsToAvoid?: string[];
  identityDimensions?: Array<{ label?: string }>;
}

const CONCEPT_GLOSSARY: Array<{
  match: RegExp;
  en: string[];
  es: string[];
  tokens: string[];
}> = [
  {
    match: /patent|patente/i,
    en: ['patent law', 'patent prosecution', 'freedom to operate'],
    es: ['patentes', 'propiedad industrial'],
    tokens: ['patent', 'patents', 'patente', 'patentes', 'uspto', 'patentability'],
  },
  {
    match: /propiedad intelectual|intellectual property|\bip\b/i,
    en: ['intellectual property', 'trade secrets'],
    es: ['propiedad intelectual', 'secretos comerciales'],
    tokens: ['intellectual', 'trademark', 'copyright', 'infringement', 'intelectual', 'marcas', 'secret', 'secrets', 'secreto', 'secretos', 'invention', 'inventor'],
  },
  {
    match: /adopc|adoption/i,
    en: ['AI adoption', 'AI readiness'],
    es: ['adopción de inteligencia artificial'],
    tokens: ['adoption', 'readiness', 'adopcion'],
  },
  {
    match: /gobernanza|governance|compliance|cumplimiento/i,
    en: ['AI governance', 'AI policy', 'NIST AI RMF'],
    es: ['gobernanza de inteligencia artificial', 'cumplimiento normativo IA'],
    tokens: ['governance', 'compliance', 'gobernanza', 'cumplimiento'],
  },
  {
    match: /inteligencia artificial|artificial intelligence|\bia\b|\bai\b|machine learning/i,
    en: ['artificial intelligence', 'generative AI'],
    es: ['inteligencia artificial', 'IA generativa'],
    tokens: ['artificial', 'chatgpt', 'copilot', 'algorithm', 'algoritmo', 'inteligencia', 'ai', 'ia', 'llm'],
  },
  {
    match: /regulaci|regulation|regulatorio|normativ/i,
    en: ['AI regulation', 'AI executive order'],
    es: ['regulación de IA', 'marco regulatorio IA'],
    tokens: ['regulation', 'regulatory', 'regulacion', 'normativa'],
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

/** Deriva keywords de ingesta desde datos Firestore (sin dbService del browser). */
export function buildProfileKeywordsFromDocs(
  client: ClientLike,
  thesis: ThesisLike | undefined,
  profile?: ProfileLike,
  dossier?: DossierLike
): ProfileKeywords {
  const conceptSource = normalize(
    [
      thesis?.domain,
      thesis?.title,
      thesis?.expertIdentity,
      client.profession,
      ...(dossier?.topicsToOwn || []),
      ...(profile?.career?.industries || []),
    ]
      .filter(Boolean)
      .join(' ')
  );

  const coreEn: string[] = [];
  const coreEs: string[] = [];
  const strong: string[] = [];
  for (const concept of CONCEPT_GLOSSARY) {
    if (concept.match.test(conceptSource)) {
      coreEn.push(...concept.en);
      coreEs.push(...concept.es);
      strong.push(...concept.tokens);
    }
  }

  if (!coreEn.length && client.profession) coreEn.push(client.profession);
  if (!coreEs.length && thesis?.domain) coreEs.push(thesis.domain);

  const context = uniq([
    ...(profile?.audience?.targetIndustries || []),
    ...(dossier?.identityDimensions || []).map((d) => d.label || ''),
  ]);

  const negative = uniq([
    ...(profile?.voicePreferences?.topicsToAvoid || []),
    ...(dossier?.topicsToAvoid || []),
  ]);

  return {
    coreEn: uniq(coreEn).slice(0, 8),
    coreEs: uniq(coreEs).slice(0, 8),
    strong: uniq(strong),
    context: context.slice(0, 8),
    negative,
  };
}
