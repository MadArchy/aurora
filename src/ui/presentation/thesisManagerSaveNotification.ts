/**
 * P5 presentation-owned client notify after SaveThesis submit_review success.
 * Mirrors legacy thesisHandlers notifyClient titles — Application only sets notifyClient flag.
 */
import { notifyClient } from '../../services/notifications';

export function notifyClientThesisManagerSave(
  clientId: string,
  title: string,
  thesisStatus: string
): boolean {
  return notifyClient(clientId, {
    type: 'THESIS',
    title:
      thesisStatus === 'ACTIVE'
        ? 'Revisión de tesis pendiente'
        : 'Tesis lista para tu aprobación',
    body: title,
  });
}
