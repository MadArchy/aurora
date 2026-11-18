/**
 * Aura — recorridos educativos paso a paso + señales de coach.
 * Lenguaje sencillo. Sin jerga técnica.
 */

import type { GuideCoachCue } from './guideCoach';

export interface GuideChoice {
  readonly label: string;
  readonly nextStepId: string;
}

export interface GuideStep {
  readonly id: string;
  readonly say: string;
  readonly doNow?: string;
  readonly choices: readonly GuideChoice[];
  /** Navegar / resaltar / faro en la UI */
  readonly coach?: GuideCoachCue;
}

export interface GuideTour {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly audience: 'todos' | 'cliente' | 'manager';
  readonly firstStepId: string;
  readonly steps: readonly GuideStep[];
}

export const GUIDE_TOURS: readonly GuideTour[] = [
  {
    id: 'crear-cliente',
    title: 'Cómo crear un cliente',
    subtitle: 'Alta e invitación',
    audience: 'manager',
    firstStepId: 'cc-1',
    steps: [
      {
        id: 'cc-1',
        say: 'Crear un cliente lo hace el Brand Manager. Sirve para dar de alta a alguien en tu cartera e invitarlo a su portal.',
        choices: [{ label: 'Empezar', nextStepId: 'cc-2' }],
      },
      {
        id: 'cc-2',
        say: 'Vamos a la lista de clientes.',
        doNow: 'Mira el menú: debería abrirse «Clientes».',
        coach: {
          tab: 'clients',
          testId: 'react-cockpit-clients',
          navTab: 'clients',
          beaconLabel: 'Entra a «Clientes» en el menú',
        },
        choices: [{ label: 'Siguiente', nextStepId: 'cc-3' }],
      },
      {
        id: 'cc-3',
        say: 'Aquí está el botón para crear uno nuevo. Aura intenta abrirlo por ti.',
        doNow: 'Si no se abrió, toca «+ Nuevo cliente».',
        coach: {
          tab: 'clients',
          testId: 'react-cockpit-create-client',
          openCreateClient: true,
          navTab: 'clients',
          beaconLabel: 'Busca «+ Nuevo cliente» arriba en Clientes',
        },
        choices: [{ label: 'Siguiente', nextStepId: 'cc-4' }],
      },
      {
        id: 'cc-4',
        say: 'Completa nombre, apellido y correo. Lo demás es opcional.',
        doNow: 'Llena los campos marcados como obligatorios.',
        coach: {
          tab: 'clients',
          testId: 'react-cockpit-first-name',
          openCreateClient: true,
          navTab: 'clients',
          beaconLabel: 'Abre «+ Nuevo cliente» para ver el formulario',
        },
        choices: [{ label: 'Ya los llené', nextStepId: 'cc-5' }],
      },
      {
        id: 'cc-5',
        say: 'Al guardar se crea el cliente y se prepara la invitación.',
        doNow: 'Toca «Crear e invitar».',
        coach: {
          tab: 'clients',
          testId: 'react-cockpit-create-submit',
          openCreateClient: true,
          navTab: 'clients',
          beaconLabel: 'En el formulario, busca «Crear e invitar»',
        },
        choices: [{ label: 'Listo', nextStepId: 'cc-6' }],
      },
      {
        id: 'cc-6',
        say: 'El cliente ya debería aparecer en la cartera. Ahora puedes abrirlo para trabajar.',
        coach: {
          tab: 'clients',
          testId: 'react-cockpit-directory',
          navTab: 'clients',
          beaconLabel: 'Revisa la lista de clientes',
        },
        choices: [
          { label: 'Abrir un cliente', nextStepId: '__tour:abrir-cliente' },
          { label: 'Volver al menú', nextStepId: '__menu' },
        ],
      },
    ],
  },
  {
    id: 'abrir-cliente',
    title: 'Cómo abrir un cliente',
    subtitle: 'Entrar a su espacio de trabajo',
    audience: 'manager',
    firstStepId: 'ac-1',
    steps: [
      {
        id: 'ac-1',
        say: 'Cada cliente tiene su propio espacio: radar, entregas, tareas, producción y resultados.',
        choices: [{ label: 'Empezar', nextStepId: 'ac-2' }],
      },
      {
        id: 'ac-2',
        say: 'Ve a Clientes y elige a quién abrir. Aura puede abrir el primero de la lista.',
        doNow: 'Si no se abre solo, toca el botón del cliente (por ejemplo «Abrir radar»).',
        coach: {
          tab: 'clients',
          testId: 'react-cockpit-directory',
          openFirstClient: true,
          navTab: 'clients',
          beaconLabel: 'En Clientes, toca el botón del cliente que quieras abrir',
        },
        choices: [{ label: 'Ya estoy dentro', nextStepId: 'ac-3' }],
      },
      {
        id: 'ac-3',
        say: 'Cuando entras, el menú de la izquierda muestra las secciones de ese cliente.',
        doNow: 'Confirma que ves opciones como Radar, Entregas o Producción.',
        coach: {
          navTab: 'ws-radar',
          beaconLabel: 'Si no ves Radar, abre un cliente desde Clientes',
        },
        choices: [
          { label: 'Ver el Radar', nextStepId: '__tour:radar' },
          { label: 'Volver al menú', nextStepId: '__menu' },
        ],
      },
    ],
  },
  {
    id: 'radar',
    title: 'Cómo usar el Radar',
    subtitle: 'Elegir qué señales importan',
    audience: 'manager',
    firstStepId: 'rd-1',
    steps: [
      {
        id: 'rd-1',
        say: 'El Radar muestra señales del mercado y de la conversación profesional. El sistema sugiere; tú decides.',
        choices: [{ label: 'Empezar', nextStepId: 'rd-2' }],
      },
      {
        id: 'rd-2',
        say: 'Abre Radar dentro de un cliente. Si aún no estás en un cliente, Aura te lleva a Clientes.',
        doNow: 'Abre un cliente y luego toca «Radar».',
        coach: {
          tab: 'ws-radar',
          testId: 'react-ws-radar',
          navTab: 'ws-radar',
          beaconLabel: 'Abre un cliente y luego toca «Radar»',
        },
        choices: [{ label: 'Siguiente', nextStepId: 'rd-3' }],
      },
      {
        id: 'rd-3',
        say: 'Revisa una o dos señales. Puedes enviarlas a curación, descartarlas o asociarlas a una tesis.',
        doNow: 'Mira la lista de señales resaltada.',
        coach: {
          tab: 'ws-radar',
          testId: 'react-ws-signal-list',
          selector: '[data-testid="react-ws-radar-empty"], [data-testid="react-ws-signal-list"]',
          navTab: 'ws-radar',
          beaconLabel: 'En Radar verás la lista de señales (o un aviso si está vacía)',
        },
        choices: [{ label: 'Siguiente', nextStepId: 'rd-4' }],
      },
      {
        id: 'rd-4',
        say: 'Lo que envíes a curación luego se trabaja en Entregas. No hace falta vaciar el Radar de un solo golpe.',
        choices: [
          { label: 'Ir a Entregas', nextStepId: '__tour:entregas' },
          { label: 'Volver al menú', nextStepId: '__menu' },
        ],
      },
    ],
  },
  {
    id: 'entregas',
    title: 'Cómo armar una entrega',
    subtitle: 'De señales a paquete para el cliente',
    audience: 'manager',
    firstStepId: 'en-1',
    steps: [
      {
        id: 'en-1',
        say: 'En Entregas conviertes lo curado en algo que el cliente pueda usar: un paquete claro, no un informe eterno.',
        choices: [{ label: 'Empezar', nextStepId: 'en-2' }],
      },
      {
        id: 'en-2',
        say: 'Abre «Entregas» dentro del cliente.',
        coach: {
          tab: 'ws-deliver',
          testId: 'react-ws-deliver',
          navTab: 'ws-deliver',
          beaconLabel: 'Abre un cliente y toca «Entregas»',
        },
        choices: [{ label: 'Siguiente', nextStepId: 'en-3' }],
      },
      {
        id: 'en-3',
        say: 'Verás pendientes y listos. Desde ahí puedes proponer un ángulo, crear un brief o armar el borrador de entrega.',
        doNow: 'Revisa la zona de curación / listos.',
        coach: {
          tab: 'ws-deliver',
          selector:
            '[data-testid="react-ws-curation-list"], [data-testid="react-ws-ready-list"], [data-testid="react-ws-curation-empty"]',
          navTab: 'ws-deliver',
          beaconLabel: 'En Entregas busca la lista de pendientes o listos',
        },
        choices: [
          { label: 'Ver cómo se publica', nextStepId: '__tour:publicar' },
          { label: 'Volver al menú', nextStepId: '__menu' },
        ],
      },
    ],
  },
  {
    id: 'fuentes',
    title: 'Cómo cuidar las fuentes',
    subtitle: 'De dónde salen las señales',
    audience: 'manager',
    firstStepId: 'fu-1',
    steps: [
      {
        id: 'fu-1',
        say: 'Las fuentes son los lugares que POSTURA revisa para traer señales (sitios, boletines, etc.).',
        choices: [{ label: 'Empezar', nextStepId: 'fu-2' }],
      },
      {
        id: 'fu-2',
        say: 'Abre «Fuentes» dentro del cliente.',
        coach: {
          tab: 'ws-sources-react',
          testId: 'react-ws-sources',
          navTab: 'ws-sources-react',
          beaconLabel: 'Abre un cliente y toca «Fuentes»',
        },
        choices: [{ label: 'Siguiente', nextStepId: 'fu-3' }],
      },
      {
        id: 'fu-3',
        say: 'Puedes registrar una fuente nueva o revisar las que ya existen. Si algo falla, el Radar se queda sin material fresco.',
        doNow: 'Mira el botón de registrar o la lista.',
        coach: {
          tab: 'ws-sources-react',
          selector:
            '[data-testid="react-ws-sources-open-register"], [data-testid="react-ws-source-list"], [data-testid="react-ws-sources-empty"]',
          navTab: 'ws-sources-react',
          beaconLabel: 'En Fuentes busca «Registrar» o la lista de fuentes',
        },
        choices: [{ label: 'Volver al menú', nextStepId: '__menu' }],
      },
    ],
  },
  {
    id: 'publicar',
    title: 'Cómo se publica algo',
    subtitle: 'Revisar → listo → publicar',
    audience: 'todos',
    firstStepId: 'pu-1',
    steps: [
      {
        id: 'pu-1',
        say: 'Publicar no es el primer botón. Primero hay un borrador y una revisión humana.',
        choices: [{ label: 'Empezar', nextStepId: 'pu-2' }],
      },
      {
        id: 'pu-2',
        say: 'El cliente revisa en «Revisar». Puede pedir cambios o aprobar.',
        doNow: 'Si eres cliente, Aura te lleva a Revisar.',
        coach: {
          tab: 'client-content',
          testId: 'react-portal-content',
          navTab: 'client-content',
          beaconLabel: 'Cliente: toca «Revisar». Manager: espera esa aprobación.',
        },
        choices: [{ label: 'Siguiente', nextStepId: 'pu-3' }],
      },
      {
        id: 'pu-3',
        say: 'El manager cierra el ciclo en Producción: calidad → listo → publicar.',
        doNow: 'Si eres manager, abre Producción dentro del cliente.',
        coach: {
          tab: 'ws-production',
          testId: 'react-ws-production',
          navTab: 'ws-production',
          beaconLabel: 'Manager: abre un cliente y toca «Producción»',
        },
        choices: [{ label: 'Siguiente', nextStepId: 'pu-4' }],
      },
      {
        id: 'pu-4',
        say: 'Resumen: proponer → revisar juntos → calidad → publicar.',
        choices: [{ label: 'Volver al menú', nextStepId: '__menu' }],
      },
    ],
  },
  {
    id: 'cliente-semana',
    title: 'Tu semana como cliente',
    subtitle: 'Qué hacer, en orden',
    audience: 'cliente',
    firstStepId: 'cs-1',
    steps: [
      {
        id: 'cs-1',
        say: 'Como cliente, el menú es corto: Esta semana, Revisar, Oportunidades y tu trayectoria.',
        coach: {
          tab: 'client-home',
          navTab: 'client-home',
          beaconLabel: 'Toca «Esta semana» en el menú',
        },
        choices: [{ label: 'Ya estoy ahí', nextStepId: 'cs-2' }],
      },
      {
        id: 'cs-2',
        say: '«Esta semana» te dice el foco. No necesitas recorrer todo el sistema.',
        doNow: 'Lee el resumen de la semana.',
        coach: {
          tab: 'client-home',
          testId: 'react-client-portal',
          navTab: 'client-home',
          beaconLabel: 'Abre «Esta semana»',
        },
        choices: [{ label: 'Siguiente', nextStepId: 'cs-3' }],
      },
      {
        id: 'cs-3',
        say: 'Si hay una tarea de grabación, ábrela y sigue el texto de apoyo.',
        coach: {
          tab: 'client-feed',
          testId: 'react-portal-tasks',
          navTab: 'client-feed',
          beaconLabel: 'Busca tus tareas / esta semana en el menú',
        },
        choices: [{ label: 'Siguiente', nextStepId: 'cs-4' }],
      },
      {
        id: 'cs-4',
        say: 'En «Revisar» ves borradores. Puedes pedir cambios o aprobar.',
        coach: {
          tab: 'client-content',
          testId: 'react-portal-content',
          navTab: 'client-content',
          beaconLabel: 'Toca «Revisar» en el menú',
        },
        choices: [{ label: 'Siguiente', nextStepId: 'cs-5' }],
      },
      {
        id: 'cs-5',
        say: 'En «Oportunidades» decides si aceptas invitaciones (charlas, posts, etc.).',
        coach: {
          tab: 'client-opps',
          navTab: 'client-opps',
          beaconLabel: 'Toca «Oportunidades» en el menú',
        },
        choices: [{ label: 'Listo', nextStepId: 'cs-6' }],
      },
      {
        id: 'cs-6',
        say: 'Ritmo semanal: foco → tarea → revisar → oportunidades.',
        choices: [{ label: 'Volver al menú', nextStepId: '__menu' }],
      },
    ],
  },
  {
    id: 'manager-hoy',
    title: 'Tu día como manager',
    subtitle: 'De la cola a la entrega',
    audience: 'manager',
    firstStepId: 'mh-1',
    steps: [
      {
        id: 'mh-1',
        say: '«Hoy» es tu cola: qué clientes necesitan atención primero.',
        coach: {
          tab: 'dashboard',
          testId: 'react-cockpit-hoy',
          navTab: 'dashboard',
          beaconLabel: 'Toca «Hoy» en el menú Cartera',
        },
        choices: [{ label: 'Siguiente', nextStepId: 'mh-2' }],
      },
      {
        id: 'mh-2',
        say: 'Si la cola está quieta, ve a Clientes y abre uno.',
        coach: {
          tab: 'clients',
          testId: 'react-cockpit-clients',
          navTab: 'clients',
          beaconLabel: 'Toca «Clientes»',
        },
        choices: [{ label: 'Siguiente', nextStepId: 'mh-3' }],
      },
      {
        id: 'mh-3',
        say: 'Dentro del cliente empieza por Radar: elige qué señales importan.',
        coach: {
          tab: 'ws-radar',
          testId: 'react-ws-radar',
          navTab: 'ws-radar',
          beaconLabel: 'Abre un cliente y toca «Radar»',
        },
        choices: [{ label: 'Siguiente', nextStepId: 'mh-4' }],
      },
      {
        id: 'mh-4',
        say: 'Luego pasa a Entregas o Briefs para mandar algo accionable.',
        coach: {
          tab: 'ws-deliver',
          testId: 'react-ws-deliver',
          navTab: 'ws-deliver',
          beaconLabel: 'Dentro del cliente, toca «Entregas»',
        },
        choices: [{ label: 'Siguiente', nextStepId: 'mh-5' }],
      },
      {
        id: 'mh-5',
        say: 'Cuando el cliente apruebe, cierra en Producción: calidad → listo → publicar.',
        coach: {
          tab: 'ws-production',
          testId: 'react-ws-production',
          navTab: 'ws-production',
          beaconLabel: 'Dentro del cliente, toca «Producción»',
        },
        choices: [
          { label: 'Detalle de publicar', nextStepId: '__tour:publicar' },
          { label: 'Volver al menú', nextStepId: '__menu' },
        ],
      },
    ],
  },
  {
    id: 'que-es',
    title: '¿Qué es POSTURA?',
    subtitle: 'La idea en 4 pasos',
    audience: 'todos',
    firstStepId: 'qe-1',
    steps: [
      {
        id: 'qe-1',
        say: 'POSTURA ayuda a que tu posicionamiento profesional se note cada semana, con acciones pequeñas y claras.',
        choices: [{ label: 'Siguiente', nextStepId: 'qe-2' }],
      },
      {
        id: 'qe-2',
        say: 'El Brand Manager organiza y propone. El cliente revisa, aprueba o graba — normalmente en 15 a 30 minutos.',
        choices: [{ label: 'Siguiente', nextStepId: 'qe-3' }],
      },
      {
        id: 'qe-3',
        say: 'Nada se publica solo. Primero se propone, luego alguien revisa, y solo después se publica.',
        choices: [{ label: 'Siguiente', nextStepId: 'qe-4' }],
      },
      {
        id: 'qe-4',
        say: 'Elige un recorrido práctico para seguir con señales en pantalla.',
        choices: [
          { label: 'Soy cliente', nextStepId: '__tour:cliente-semana' },
          { label: 'Soy manager', nextStepId: '__tour:manager-hoy' },
          { label: 'Volver al menú', nextStepId: '__menu' },
        ],
      },
    ],
  },
  {
    id: 'primeros-pasos',
    title: 'Primeros pasos en la app',
    subtitle: 'Orientación al entrar',
    audience: 'todos',
    firstStepId: 'pp-1',
    steps: [
      {
        id: 'pp-1',
        say: 'A la izquierda está el menú. Al centro, el contenido de la pantalla actual.',
        coach: {
          selector: '.sidebar-nav',
          beaconLabel: 'Mira el menú de la izquierda',
        },
        choices: [{ label: 'Siguiente', nextStepId: 'pp-2' }],
      },
      {
        id: 'pp-2',
        say: 'Debajo del logo POSTURA ves tu rol: «Cockpit del manager» o portal del cliente.',
        coach: {
          selector: '.sidebar-role',
          beaconLabel: 'Mira el texto debajo del logo POSTURA',
        },
        choices: [{ label: 'Siguiente', nextStepId: 'pp-3' }],
      },
      {
        id: 'pp-3',
        say: 'Elige un solo recorrido y síguelo hasta el final. Aura irá iluminando cada zona.',
        choices: [
          { label: 'Crear un cliente', nextStepId: '__tour:crear-cliente' },
          { label: 'Semana del cliente', nextStepId: '__tour:cliente-semana' },
          { label: 'Volver al menú', nextStepId: '__menu' },
        ],
      },
    ],
  },
];

export function getTour(tourId: string): GuideTour | undefined {
  return GUIDE_TOURS.find((tour) => tour.id === tourId);
}

export function getStep(tour: GuideTour, stepId: string): GuideStep | undefined {
  return tour.steps.find((step) => step.id === stepId);
}

export function stepProgress(tour: GuideTour, stepId: string): { current: number; total: number } {
  const index = tour.steps.findIndex((step) => step.id === stepId);
  return {
    current: index >= 0 ? index + 1 : 1,
    total: tour.steps.length,
  };
}

function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[¿?¡!.,;:()"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const QUESTION_RULES: ReadonlyArray<{
  readonly tourId: string;
  readonly patterns: readonly string[];
  readonly weight: number;
}> = [
  {
    tourId: 'crear-cliente',
    weight: 22,
    patterns: [
      'crear un cliente',
      'creo un cliente',
      'crear cliente',
      'nuevo cliente',
      'dar de alta',
      'agregar cliente',
      'añadir cliente',
      'anadir cliente',
      'invitar cliente',
      'como creo un cliente',
      'como crear un cliente',
    ],
  },
  {
    tourId: 'abrir-cliente',
    weight: 20,
    patterns: [
      'abrir un cliente',
      'abrir cliente',
      'entrar a un cliente',
      'entrar al cliente',
      'espacio de trabajo',
      'abrir workspace',
    ],
  },
  {
    tourId: 'radar',
    weight: 18,
    patterns: ['radar', 'senales', 'señales', 'usar el radar', 'ver el radar', 'curar senales'],
  },
  {
    tourId: 'entregas',
    weight: 18,
    patterns: ['entrega', 'entregas', 'armar una entrega', 'paquete', 'curacion', 'curación'],
  },
  {
    tourId: 'fuentes',
    weight: 18,
    patterns: ['fuentes', 'fuente', 'de donde salen', 'registrar fuente'],
  },
  {
    tourId: 'publicar',
    weight: 17,
    patterns: [
      'publicar',
      'como publico',
      'como se publica',
      'produccion',
      'producción',
      'aprobar y publicar',
    ],
  },
  {
    tourId: 'cliente-semana',
    weight: 15,
    patterns: [
      'soy cliente',
      'como cliente',
      'mi semana',
      'esta semana',
      'grabar un video',
      'revisar borrador',
      'oportunidades',
    ],
  },
  {
    tourId: 'manager-hoy',
    weight: 15,
    patterns: [
      'soy manager',
      'brand manager',
      'como manager',
      'cola de atencion',
      'atender cliente',
      'mi dia',
    ],
  },
  {
    tourId: 'que-es',
    weight: 12,
    patterns: ['que es postura', 'para que sirve', 'que hace postura', 'explicame postura'],
  },
  {
    tourId: 'primeros-pasos',
    weight: 10,
    patterns: ['primeros pasos', 'como empiezo', 'como uso', 'estoy perdido', 'orientacion'],
  },
];

export function matchTourFromQuestion(question: string): string | null {
  const q = normalizeQuestion(question);
  if (!q) return null;

  let best: { tourId: string; score: number } | null = null;
  for (const rule of QUESTION_RULES) {
    for (const pattern of rule.patterns) {
      const p = normalizeQuestion(pattern);
      if (!p) continue;
      let score = 0;
      if (q === p) score = rule.weight + 40;
      else if (q.includes(p)) score = rule.weight + Math.min(p.length, 24);
      else if (q.length >= 12 && p.includes(q)) score = rule.weight + 4;
      else continue;
      if (!best || score > best.score) best = { tourId: rule.tourId, score };
    }
  }
  return best?.tourId ?? null;
}

export function suggestToursForUnknown(question: string): readonly string[] {
  const q = normalizeQuestion(question);
  if (q.includes('cliente')) return ['crear-cliente', 'abrir-cliente', 'cliente-semana'];
  if (q.includes('public') || q.includes('aprobar')) return ['publicar', 'entregas'];
  return ['primeros-pasos', 'manager-hoy', 'cliente-semana'];
}
