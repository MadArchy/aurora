import type { ClientProfile, ProfileFactSection } from '../types';

export const PROFILE_SECTION_LABELS: Record<ProfileFactSection, string> = {
  identity: 'Identidad',
  career: 'Trayectoria',
  education: 'Formación',
  credentials: 'Credenciales',
  publications: 'Publicaciones',
  institutions: 'Instituciones',
  digital: 'Presencia digital',
  voice: 'Voz y compliance',
  services: 'Servicios',
};

export const PROFILE_SECTION_ORDER: ProfileFactSection[] = [
  'identity',
  'career',
  'education',
  'credentials',
  'publications',
  'institutions',
  'digital',
  'voice',
  'services',
];

export interface SectionCoverage {
  section: ProfileFactSection;
  label: string;
  confirmed: number;
  candidates: number;
  complete: boolean;
}

export interface ProfileCoverageReport {
  sections: SectionCoverage[];
  totalConfirmed: number;
  sectionsWithFacts: number;
  meetsPilotThreshold: boolean;
}

export function computeProfileCoverage(profile: ClientProfile | null): ProfileCoverageReport {
  const facts = profile?.facts || [];
  const sections = PROFILE_SECTION_ORDER.map((section) => {
    const sectionFacts = facts.filter((f) => f.section === section);
    const confirmed = sectionFacts.filter((f) => f.status === 'confirmed').length;
    const candidates = sectionFacts.filter((f) => f.status === 'candidate').length;
    return {
      section,
      label: PROFILE_SECTION_LABELS[section],
      confirmed,
      candidates,
      complete: confirmed > 0,
    };
  });

  const totalConfirmed = facts.filter((f) => f.status === 'confirmed').length;
  const sectionsWithFacts = sections.filter((s) => s.complete).length;

  return {
    sections,
    totalConfirmed,
    sectionsWithFacts,
    meetsPilotThreshold: totalConfirmed >= 20 && sectionsWithFacts >= 5,
  };
}

export function nextIncompleteOnboardingStep(profile: ClientProfile | null): number {
  const coverage = computeProfileCoverage(profile);
  const stepBySection: ProfileFactSection[][] = [
    ['identity', 'career'],
    ['services'],
    ['identity'],
    ['education', 'credentials', 'publications', 'institutions'],
    ['digital'],
    ['voice'],
  ];

  for (let i = 0; i < stepBySection.length; i += 1) {
    const sections = stepBySection[i];
    const done = sections.every((section) =>
      coverage.sections.find((s) => s.section === section)?.complete
    );
    if (!done) return i + 1;
  }
  return 6;
}
