import { createId } from '../lib/id';
import type { ClientProfile, ProfileFact, ProfileFactSection } from '../types';

function fact(
  section: ProfileFactSection,
  label: string,
  value: string,
  source: ProfileFact['source'] = 'onboarding'
): ProfileFact {
  const now = new Date().toISOString();
  return {
    id: createId('fact'),
    section,
    label,
    value,
    status: 'confirmed',
    source,
    createdAt: now,
    updatedAt: now,
  };
}

/** Materializa facts confirmados desde el perfil maestro existente. */
export function buildFactsFromProfile(profile: ClientProfile): ProfileFact[] {
  const facts: ProfileFact[] = [];

  if (profile.identity.professionalHeadline) {
    facts.push(fact('identity', 'Headline profesional', profile.identity.professionalHeadline));
  }
  if (profile.identity.selfDescription) {
    facts.push(fact('identity', 'Autodescripción', profile.identity.selfDescription));
  }
  if (profile.identity.shortBio) {
    facts.push(fact('identity', 'Bio corta', profile.identity.shortBio));
  }
  if (profile.identity.longBio) {
    facts.push(fact('identity', 'Bio larga', profile.identity.longBio));
  }
  if (profile.identity.location) {
    facts.push(fact('identity', 'Ubicación', profile.identity.location));
  }
  (profile.identity.languages || []).forEach((lang) => {
    facts.push(fact('identity', 'Idioma', lang));
  });

  if (profile.goals.primaryGoal) {
    facts.push(fact('services', 'Objetivo principal', profile.goals.primaryGoal));
  }
  (profile.goals.secondaryGoals || []).forEach((goal) => {
    facts.push(fact('services', 'Objetivo secundario', goal));
  });

  if (profile.audience.targetAudienceDescription) {
    facts.push(fact('identity', 'Audiencia objetivo', profile.audience.targetAudienceDescription));
  }
  (profile.audience.targetIndustries || []).forEach((industry) => {
    facts.push(fact('career', 'Industria objetivo', industry));
  });
  (profile.audience.targetCountries || []).forEach((country) => {
    facts.push(fact('identity', 'Mercado objetivo', country));
  });

  if (profile.career.profession) facts.push(fact('career', 'Profesión', profile.career.profession));
  if (profile.career.currentRole) facts.push(fact('career', 'Rol actual', profile.career.currentRole));
  if (profile.career.currentCompany) facts.push(fact('career', 'Organización actual', profile.career.currentCompany));
  if (profile.career.yearsExperience) {
    facts.push(fact('career', 'Años de experiencia', String(profile.career.yearsExperience)));
  }
  (profile.career.industries || []).forEach((industry) => {
    facts.push(fact('career', 'Industria de práctica', industry));
  });

  profile.education.forEach((edu) => {
    facts.push(
      fact('education', edu.degree || 'Formación', `${edu.degree}${edu.institution ? ` — ${edu.institution}` : ''}${edu.year ? ` (${edu.year})` : ''}`)
    );
  });

  profile.careerHistory.forEach((entry) => {
    facts.push(
      fact(
        'career',
        entry.role || 'Experiencia',
        `${entry.role}${entry.organization ? ` @ ${entry.organization}` : ''}${entry.period ? ` (${entry.period})` : ''}: ${entry.highlight}`
      )
    );
  });

  profile.ventures.forEach((venture) => {
    facts.push(fact('institutions', 'Rol institucional', venture));
  });

  profile.keyPublications.forEach((pub) => {
    facts.push(fact('publications', pub.title, `${pub.title}${pub.outlet ? ` — ${pub.outlet}` : ''}${pub.url ? ` (${pub.url})` : ''}`));
  });

  if (profile.socialLinks.linkedin) facts.push(fact('digital', 'LinkedIn', profile.socialLinks.linkedin));
  if (profile.socialLinks.website) facts.push(fact('digital', 'Sitio web', profile.socialLinks.website));
  if (profile.socialLinks.twitter) facts.push(fact('digital', 'Twitter/X', profile.socialLinks.twitter));
  if (profile.socialLinks.youtube) facts.push(fact('digital', 'YouTube', profile.socialLinks.youtube));

  facts.push(fact('voice', 'Tono preferido', profile.voicePreferences.tone));
  (profile.voicePreferences.preferredPhrases || []).forEach((phrase) => {
    facts.push(fact('voice', 'Frase preferida', phrase));
  });
  (profile.voicePreferences.topicsToAvoid || []).forEach((topic) => {
    facts.push(fact('voice', 'Tema a evitar', topic));
  });
  if (profile.voicePreferences.complianceGuidelines) {
    facts.push(fact('voice', 'Reglas de compliance', profile.voicePreferences.complianceGuidelines));
  }

  return facts;
}
