export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escAttr(value: unknown): string {
  return esc(value).replace(/`/g, '&#96;');
}

export function nl2br(value: unknown): string {
  return esc(value).replace(/\n/g, '<br>');
}

/** Solo permite http/https para atributos href. */
export function safeHref(raw: unknown): string {
  const value = String(raw ?? '').trim();
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return escAttr(value);
  } catch {
    /* ignore */
  }
  return '#';
}
