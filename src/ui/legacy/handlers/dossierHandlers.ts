import { authService } from '../../../services/auth';
import { dbService } from '../../../services/db';
import { auditService } from '../../../services/audit';
import { formatDossierMarkdown, downloadDossierMarkdown } from '../../../services/dossierExport';
import type { DossierHandlerHost } from '../legacyAppHost';

export function bindDossierHandlers(host: DossierHandlerHost): void  {
  document.querySelectorAll('.btn-export-dossier').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const clientId = (e.currentTarget as HTMLElement).getAttribute('data-client-id') || host.resolveClientId();
      const client = dbService.getClientById(clientId);
      const dossier = dbService.getMasterDossier(clientId);
      if (!client || !dossier) {
        host.showToast('No hay dossier maestro para este cliente.', 'warning');
        return;
      }
      downloadDossierMarkdown(dossier, client);
      auditService.log(authService.getCurrentUser(), 'EXPORT_DOSSIER', 'MasterDossier', clientId);
      host.showToast('Dossier descargado en Markdown.', 'success');
    });
  });

  document.querySelectorAll('.btn-copy-dossier').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const clientId = (e.currentTarget as HTMLElement).getAttribute('data-client-id') || host.resolveClientId();
      const client = dbService.getClientById(clientId);
      const dossier = dbService.getMasterDossier(clientId);
      if (!client || !dossier) {
        host.showToast('No hay dossier maestro para este cliente.', 'warning');
        return;
      }
      const markdown = formatDossierMarkdown(dossier, client);
      try {
        await navigator.clipboard.writeText(markdown);
        auditService.log(authService.getCurrentUser(), 'COPY_DOSSIER', 'MasterDossier', clientId);
        host.showToast('Dossier copiado al portapapeles.', 'success');
      } catch {
        host.showToast('No se pudo copiar. Usa Descargar .md', 'warning');
      }
    });
  });
}
