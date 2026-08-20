import { MasterDossier } from '../types';

/** Dossier maestro verificado + pendientes — Juan J. Vasquez, Whitaker Chalk. */
export function buildJuanMasterDossier(): MasterDossier {
  return {
    id: 'dossier_juan_001',
    organizationId: 'org_aurora_01',
    clientId: 'client_juan_001',
    version: '1.0',
    updatedAt: '2026-08-19T17:00:00Z',
    taglineEn: 'Intellectual Property and AI Adoption Attorney',
    subtitleEn: 'Helping organizations protect innovation, assess AI readiness, and adopt AI responsibly.',
    executiveSummary:
      'Juan J. Vasquez es abogado de propiedad intelectual en Whitaker Chalk (Fort Worth, Texas), con formación de ingeniero eléctrico (UT Austin), experiencia en ciberseguridad (DoD y U.S. Air Force) y práctica centrada en patentes, FTO y adopción responsable de IA. No debe posicionarse como "experto genérico en IA" ni reducirse a "Patent Attorney" sin el ángulo de AI Adoption. Su activo más valioso es el marco People + Tools + Rules (AI Posture & Readiness).',
    narrativeArc:
      'Ingeniería Eléctrica (UT Austin) → Ciberseguridad (DoD + U.S. Air Force) → Derecho (St. Mary\'s JD) → Patentes e IP (Registered Patent Attorney) → Inteligencia Artificial → Gobernanza y adopción de IA en organizaciones.',
    identityDimensions: [
      { label: 'Derecho', value: 'Abogado de propiedad intelectual — Member, Whitaker Chalk (desde may 2022)' },
      { label: 'Patentes', value: 'Registered Patent Attorney — strategy, prosecution, FTO, opinions, litigio IP' },
      { label: 'Ingeniería', value: 'B.S. Electrical Engineering — The University of Texas at Austin' },
      { label: 'Ciberseguridad', value: 'Ingeniero y oficial de ciberseguridad — DoD + U.S. Air Force' },
      { label: 'IA', value: 'Adopción, riesgo y gobernanza — marco People + Tools + Rules' },
      { label: 'Empresa', value: 'Asesoramiento a compañías, startups y equipos legales adoptando IA' },
      { label: 'Institucional', value: 'Chair, Emerging Technology Committee — State Bar of Texas (2025–2027)' },
      { label: 'Liderazgo intelectual', value: 'Coautor libro IA+Patentes (2024); President of the Board, 3ITAL; conferencias US/México' },
    ],
    serviceLines: [
      {
        name: 'Intellectual Property & Patent Practice',
        description: 'Práctica jurídica central vinculada a tecnología e innovación.',
        offerings: [
          'Patent strategy y portafolios internacionales',
          'Patent preparation y prosecution',
          'Patentability, FTO, non-infringement e invalidity opinions',
          'Litigio y apoyo transaccional de tecnología',
          'AI + IP consulting',
        ],
      },
      {
        name: 'AI Adoption, Readiness & Governance',
        description: 'Línea estratégica que eleva la marca más allá del "AI lawyer".',
        offerings: [
          'AI Readiness Briefing y AI Posture Assessment',
          'AI Governance & Policy Development',
          'Vendor review y governance workflows',
          'Executive reports y hoja de ruta (NIST AI RMF, ISO/IEC 42001)',
          'Continuous AI adoption advisory',
        ],
      },
    ],
    targetAudiences: [
      'General Counsel y IP Counsel en empresas que adoptan IA',
      'CTOs/CIOs y líderes de innovación',
      'Startups con portafolios de patentes y productos de IA',
      'Equipos legales evaluando herramientas (ChatGPT, Copilot, vendors)',
      'Audiencias institucionales: State Bar, 3ITAL, conferencias US/México',
    ],
    differentiators: [
      'Comprende el problema legal y técnico simultáneamente (abogado + ingeniero + cyber)',
      'Práctica IP real, no solo comentario regulatorio',
      'Marco propio: People + Tools + Rules / AI Posture & Readiness',
      'Autoridad institucional: Chair State Bar TX + 3ITAL',
      'Presencia binacional US/México (libro, conferencias, STJ Jalisco)',
    ],
    topicsToOwn: [
      'Adopción informal de IA antes de que exista política corporativa',
      'People + Tools + Rules en organizaciones',
      'AI Posture Assessment y brechas de preparación',
      'Patentes, FTO e IP en productos con componente de IA',
      'Secretos comerciales y outputs de IA — quién es propietario',
      'Vendor review y shadow AI en equipos legales',
      'NIST AI RMF e ISO/IEC 42001 aplicados a empresas reales',
      'IA en patent practice (libro 2024) — augment, not replace',
    ],
    topicsToAvoid: [
      '"Experto en inteligencia artificial" — demasiado genérico',
      '"Abogado especializado en gobernanza de IA" — demasiado estrecho sin IP',
      '"Patent Attorney" aislado — pierde ventaja tecnológica',
      'Comentar noticias de IA sin analizar impacto en adopción, IP o riesgo empresarial',
      'Afirmar "Fundador de 3ITAL" — usar President of the Board hasta confirmar',
      'Director del "3i BAIRD Lab" — pendiente verificación',
      'Best Lawyers 2026 — sin evidencia suficiente aún',
    ],
    clientQuestions: [
      '¿Estamos usando IA pero sabemos realmente cómo la usamos?',
      '¿Qué herramientas usan los empleados (ChatGPT, Copilot, otros)?',
      '¿Qué información van a esas plataformas o vendors?',
      '¿Quién es propietario de los outputs generados?',
      '¿Estamos exponiendo secretos comerciales o IP?',
      '¿Tenemos políticas de IA y se cumplen en la práctica?',
      '¿Hay formación, responsables y documentación del uso?',
      '¿Qué tecnologías desarrollamos que deberían patentarse?',
      '¿Tenemos libertad para operar (FTO) o riesgo de infracción?',
    ],
    pendingVerification: [
      'Título de "Fundador" de 3ITAL — página pública confirma President of the Board',
      'Director del "3i BAIRD Lab" — nombre oficial, cargo, organización, proyectos',
      'Participación específica en startups de dispositivos médicos',
      'Best Lawyers 2026 — no incluir sin confirmación documental',
    ],
    channelGuides: [
      {
        channel: 'LINKEDIN',
        headline: 'Intellectual Property & AI Adoption Attorney | Member @ Whitaker Chalk',
        bio: 'I help organizations protect innovation and adopt AI responsibly. Patent attorney + electrical engineer. Chair, State Bar of Texas Emerging Technology Committee. People + Tools + Rules.',
        dos: [
          'Analizar noticias por impacto en adopción empresarial, IP y riesgo',
          'Usar marco People + Tools + Rules',
          'Citar credenciales verificables (Whitaker Chalk, State Bar, 3ITAL, libro)',
          'Mezclar inglés para mercado US; español para México/LATAM',
        ],
        donts: [
          'Headline genérico "AI Expert" o solo "Patent Attorney"',
          'Hot takes de IA sin diagnóstico accionable',
          'Claims no verificados (Fundador 3ITAL, BAIRD Lab)',
        ],
      },
      {
        channel: 'WEBSITE',
        headline: 'Protect Innovation. Adopt AI Responsibly.',
        bio: 'Juan J. Vasquez is a Member at Whitaker Chalk, combining patent practice with AI adoption advisory. Registered Patent Attorney. B.S.E.E. (UT Austin). Former DoD/USAF cybersecurity. Chair, State Bar of Texas Emerging Technology Committee.',
        dos: [
          'Dos líneas de servicio claras: IP/Patents + AI Adoption',
          'Evidence vault visible: libro, comité, reconocimientos',
          'CTA hacia AI Posture Assessment o consulta IP',
        ],
        donts: [
          'Biografía como lista interminable de cargos',
          'Prometer resultados de patentes',
        ],
      },
      {
        channel: 'YOUTUBE',
        headline: 'AI Adoption & IP — diagnósticos, no hype',
        bio: 'Videos cortos que explican qué significa una noticia para adopción de IA, patentes y gobernanza. Formato: señal → diagnóstico → 3 acciones (People/Tools/Rules).',
        dos: [
          'Teleprompter con checklist accionable para GC',
          'Ejemplos reales: shadow AI, vendors, FTO',
          'Cerrar con CTA a assessment o recurso descargable',
        ],
        donts: [
          'Reaccionar a cada titular de IA del día',
          'Videos >3 min sin estructura clara',
        ],
      },
      {
        channel: 'INSTAGRAM',
        headline: 'IP + AI Adoption en formato visual',
        bio: 'Carruseles: People/Tools/Rules, preguntas que toda empresa debería hacerse, citas del libro. Presencia en eventos US/México.',
        dos: [
          'Infografías del marco de adopción',
          'Fotos de conferencias y State Bar/3ITAL',
          'Stories con una pregunta diagnóstica por slide',
        ],
        donts: [
          'Contenido puramente aspiracional sin sustancia legal/técnica',
        ],
      },
      {
        channel: 'FACEBOOK',
        headline: 'Mismo núcleo, audiencia más amplia en español',
        bio: 'Adaptar contenido LinkedIn/YouTube para audiencia hispanohablante — especialmente México. Enfoque en adopción responsable e IP.',
        dos: [
          'Republicar clips con subtítulos en español',
          'Destacar presentación libro en Jalisco y mercado mexicano',
        ],
        donts: [
          'Duplicar contenido sin adaptar idioma y contexto',
        ],
      },
    ],
    newsEditorialRule:
      'Las noticias de IA son materia prima, no el producto final. Juan no comenta IA por comentar: analiza qué significa la señal para adopción empresarial, propiedad intelectual, patentes, gobernanza y riesgo. Cada pieza debe responder: ¿qué debe hacer un GC/IP counsel esta semana?',
  };
}
