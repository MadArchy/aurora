import type { ProofWallItem } from '../types';
import { JUAN_ID, ORG_ID } from './juanCampaignSeed';

/** Checklist §5.3 del plan Juan — activos del muro de pruebas. */
export function buildDefaultProofWallItems(clientId: string, organizationId = ORG_ID): Omit<ProofWallItem, 'id'>[] {
  const items: Array<Omit<ProofWallItem, 'id'>> = [
    { organizationId, clientId, category: 'publications', title: 'Portada del libro y enlace de compra', description: 'Artificial Intelligence (AI) in Patent Practice (2024)', status: 'complete', sortOrder: 1, evidenceId: 'ev_003' },
    { organizationId, clientId, category: 'bios', title: 'Biografía profesional, corta y de ponente', description: 'Bio larga, corta y speaker one-sheet', status: 'pending', sortOrder: 2 },
    { organizationId, clientId, category: 'media', title: 'Retratos y fotos de eventos', description: 'Fotos recientes para web y LinkedIn', status: 'pending', sortOrder: 3, evidenceId: 'ev_juan_speaker' },
    { organizationId, clientId, category: 'publications', title: 'Lista de artículos con enlaces', description: 'Artículos emblemáticos IA/IP', status: 'pending', sortOrder: 4 },
    { organizationId, clientId, category: 'institutions', title: 'Liderazgo — Emerging Technology Committee (State Bar TX)', description: 'Descripción del rol Chair 2025–2027', status: 'complete', sortOrder: 5, evidenceId: 'ev_002' },
    { organizationId, clientId, category: 'institutions', title: 'Descripción y logo 3ITAL', description: 'International Institute for Intelligent Technology Adoption in the Law', status: 'complete', sortOrder: 6, evidenceId: 'ev_juan_3ital_logo' },
    { organizationId, clientId, category: 'institutions', title: 'Descripción y logo 3i BAIRD Lab', description: 'Pendiente verificación de cargo oficial', status: 'pending', sortOrder: 7 },
    { organizationId, clientId, category: 'speaking', title: 'Conferencias representativas', description: 'US/México — STJ Jalisco, CLE, paneles', status: 'pending', sortOrder: 8 },
    { organizationId, clientId, category: 'clients', title: 'Industrias representativas atendidas', description: 'Semiconductores, medtech, telecom, LegalTech', status: 'pending', sortOrder: 9 },
    { organizationId, clientId, category: 'services', title: 'One-pager servicios Adopción IA', description: 'PDF descargable — evaluación postura/preparación', status: 'pending', sortOrder: 10, evidenceId: 'ev_juan_services_ai' },
    { organizationId, clientId, category: 'services', title: 'One-pager servicios Patentes/IP', description: 'PDF descargable — strategy, FTO, opinions', status: 'pending', sortOrder: 11, evidenceId: 'ev_juan_services_ip' },
    { organizationId, clientId, category: 'credentials', title: 'Member — Whitaker Chalk', description: 'Credencial de firma verificada', status: 'complete', sortOrder: 12, evidenceId: 'ev_001' },
  ];
  return items;
}

export const JUAN_PROOF_WALL = buildDefaultProofWallItems(JUAN_ID);
