import { Client, MasterDossier } from '../types';

const CHANNEL_LABELS: Record<MasterDossier['channelGuides'][0]['channel'], string> = {
  LINKEDIN: 'LinkedIn',
  WEBSITE: 'Página web',
  YOUTUBE: 'YouTube',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
};

export function formatDossierMarkdown(dossier: MasterDossier, client: Client): string {
  const lines: string[] = [
    `# Dossier Maestro — ${client.displayName}`,
    '',
    `> Versión ${dossier.version} · Actualizado ${new Date(dossier.updatedAt).toLocaleDateString('es')}`,
    '',
    '---',
    '',
    '## Posicionamiento',
    '',
    `**${dossier.taglineEn}**`,
    '',
    `_${dossier.subtitleEn}_`,
    '',
    '### Resumen ejecutivo',
    '',
    dossier.executiveSummary,
    '',
    '### Arco narrativo',
    '',
    dossier.narrativeArc,
    '',
    '---',
    '',
    '## Identidad (8 dimensiones)',
    '',
    '| Dimensión | Juan Vasquez |',
    '|-----------|--------------|',
    ...dossier.identityDimensions.map((d) => `| ${d.label} | ${d.value} |`),
    '',
    '---',
    '',
    '## Líneas de servicio',
    '',
  ];

  for (const line of dossier.serviceLines) {
    lines.push(`### ${line.name}`, '', line.description, '');
    for (const o of line.offerings) lines.push(`- ${o}`);
    lines.push('');
  }

  lines.push(
    '---',
    '',
    '## Público objetivo',
    '',
    ...dossier.targetAudiences.map((a) => `- ${a}`),
    '',
    '## Diferenciadores',
    '',
    ...dossier.differentiators.map((d) => `- ${d}`),
    '',
    '## Temas que debe dominar',
    '',
    ...dossier.topicsToOwn.map((t) => `- ${t}`),
    '',
    '## Temas / framing a evitar',
    '',
    ...dossier.topicsToAvoid.map((t) => `- ${t}`),
    '',
    '## Preguntas de negocio que resuelve',
    '',
    ...dossier.clientQuestions.map((q) => `- ${q}`),
    '',
    '## Regla editorial (noticias)',
    '',
    dossier.newsEditorialRule,
    '',
    '## Pendiente de verificación',
    '',
    ...dossier.pendingVerification.map((p) => `- ${p}`),
    '',
    '---',
    '',
    '## Guías por canal',
    ''
  );

  for (const guide of dossier.channelGuides) {
    lines.push(
      `### ${CHANNEL_LABELS[guide.channel]}`,
      '',
      `**Headline:** ${guide.headline}`,
      '',
      `**Bio:** ${guide.bio}`,
      '',
      '**Hacer:**',
      ...guide.dos.map((d) => `- ${d}`),
      '',
      '**Evitar:**',
      ...guide.donts.map((d) => `- ${d}`),
      ''
    );
  }

  lines.push('---', '', '_Generado desde POSTURA_');
  return lines.join('\n');
}

export function downloadDossierMarkdown(dossier: MasterDossier, client: Client): void {
  const markdown = formatDossierMarkdown(dossier, client);
  const slug = client.displayName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dossier-${slug}-${dossier.version}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
