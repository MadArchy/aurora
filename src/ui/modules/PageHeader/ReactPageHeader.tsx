/**
 * SPEC-010 · React PageHeader (wave 2, T-010-201).
 *
 * Authority: presentation only. The header renders a title, an optional eyebrow
 * and subtitle, and a slot for actions it does not itself define.
 *
 * Reads: NONE. Commands: NONE. There is no `dbService`, store, Firestore or
 * provider dependency, which is what makes this a wave-2 leaf.
 *
 * Tab metadata lives in the shared presentation module (`pageTabMeta.ts`) so
 * React and legacy renderers stay aligned without importing the legacy HTML
 * renderer. The metadata holds no read, no command and no rule.
 */

import type { ReactNode } from 'react';
import { TAB_META } from '../../presentation/pageTabMeta';

export function ReactPageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}

/** Header for a known tab, using the same metadata the legacy renderer uses. */
export function ReactTabHeader({ tab, actions }: { tab: string; actions?: ReactNode }) {
  const meta = TAB_META[tab] || { title: 'POSTURA', subtitle: '' };
  return <ReactPageHeader title={meta.title} subtitle={meta.subtitle} actions={actions} />;
}
