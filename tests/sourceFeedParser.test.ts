/**
 * Parser RSS: extracción de texto plano.
 *
 * Defecto original: `parseRssXml` quitaba etiquetas con `replace(/<[^>]+>/g, '')`,
 * que no toca el marcado escapado como entidades. Google News manda
 * `&lt;a href="https://news.google.com/rss/articles/…"&gt;`, así que el href
 * completo sobrevivía como texto visible y desbordaba la tarjeta de señal.
 */
import { describe, expect, it } from 'vitest';

import { toPlainText as clientToPlainText, hasFeedMarkup } from '../src/lib/feedText';
import { parseRssXml, toPlainText } from '../server/sourceFeedCore';
import { toPlainText as functionsToPlainText } from '../functions/src/lib/sourceFeedCore';

function feed(items: string): string {
  return `<?xml version="1.0"?><rss><channel>${items}</channel></rss>`;
}

describe('toPlainText', () => {
  it('quita marcado crudo', () => {
    expect(toPlainText('<a href="https://x.test/a">Titular</a>')).toBe('Titular');
  });

  it('quita marcado escapado como entidades', () => {
    const raw =
      '&lt;a href="https://news.google.com/rss/articles/CBMiK2h0dHBzOi8vd3d3"&gt;Titular&lt;/a&gt;';
    expect(toPlainText(raw)).toBe('Titular');
  });

  it('quita una etiqueta escapada que viene truncada', () => {
    // El feed se corta a medias: no hay `&gt;` de cierre.
    expect(toPlainText('Titular &lt;a href="https://news.google.com/rss/a')).toBe('Titular');
  });

  it('decodifica entidades con nombre y numéricas', () => {
    expect(toPlainText('Ley &amp; Orden &#8211; caso &#x201C;X&#x201D;')).toBe(
      'Ley & Orden – caso “X”'
    );
  });

  it('convierte nbsp en espacio y colapsa el blanco', () => {
    expect(toPlainText('Uno&nbsp;&nbsp;dos\n\n  tres')).toBe('Uno dos tres');
  });

  it('deja intacta una entidad desconocida en vez de romper el texto', () => {
    expect(toPlainText('a &noexiste; b')).toBe('a &noexiste; b');
  });

  it('no inventa carácter con un punto de código fuera de rango', () => {
    expect(toPlainText('a &#1114112; b')).toBe('a &#1114112; b');
  });

  it('no confunde una comparación con una etiqueta', () => {
    expect(toPlainText('5 &lt; 10 y 20 &gt; 3')).toBe('5 < 10 y 20 > 3');
  });

  it('devuelve cadena vacía para entrada vacía', () => {
    expect(toPlainText('')).toBe('');
  });
});

describe('parseRssXml', () => {
  it('limpia título y snippet de un item estilo Google News', () => {
    const xml = feed(`
      <item>
        <title>Top 7 Patent Tools in 2026 - TechBullion</title>
        <link>https://news.google.com/rss/articles/CBMiK2h0dHBz</link>
        <description>&lt;a href="https://news.google.com/rss/articles/CBMiK2h0dHBz"&gt;Top 7 Patent Tools&lt;/a&gt;&nbsp;&nbsp;&lt;font color="#6f6f6f"&gt;TechBullion&lt;/font&gt;</description>
        <pubDate>Mon, 24 Aug 2026 10:00:00 GMT</pubDate>
      </item>
    `);

    const [item] = parseRssXml(xml);

    expect(item.title).toBe('Top 7 Patent Tools in 2026 - TechBullion');
    expect(item.snippet).toBe('Top 7 Patent Tools TechBullion');
    expect(item.snippet).not.toContain('href');
    expect(item.snippet).not.toContain('<');
  });

  it('desescapa &amp; en el href del enlace', () => {
    const xml = feed(
      '<item><title>T</title><link href="https://x.test/a?b=1&amp;c=2"/></item>'
    );

    expect(parseRssXml(xml)[0].link).toBe('https://x.test/a?b=1&c=2');
  });

  it('soporta CDATA y entradas Atom', () => {
    const xml = `<feed><entry>
      <title><![CDATA[Titular <b>con</b> marcado]]></title>
      <link href="https://x.test/a"/>
      <summary><![CDATA[<p>Resumen</p>]]></summary>
    </entry></feed>`;

    const [item] = parseRssXml(xml);

    expect(item.title).toBe('Titular con marcado');
    expect(item.snippet).toBe('Resumen');
  });

  it('recorta el snippet a 500 caracteres ya limpios', () => {
    const long = 'palabra '.repeat(200);
    const xml = feed(`<item><title>T</title><description>&lt;p&gt;${long}&lt;/p&gt;</description></item>`);

    const [item] = parseRssXml(xml);

    expect(item.snippet.length).toBeLessThanOrEqual(500);
    expect(item.snippet).not.toContain('<');
  });

  it('descarta items sin título', () => {
    const xml = feed('<item><description>Solo cuerpo</description></item>');
    expect(parseRssXml(xml)).toHaveLength(0);
  });
});

/**
 * `toPlainText` vive por triplicado (`src/lib/feedText.ts`, `server/`,
 * `functions/src/lib/`) porque cada uno es un target de build distinto y `src` no
 * puede importar de los otros. Este bloque impide que se separen en silencio.
 */
describe('paridad entre las tres copias de toPlainText', () => {
  const FIXTURES = [
    '',
    'Titular limpio',
    '<a href="https://x.test/a">Titular</a>',
    '&lt;a href="https://news.google.com/rss/articles/CBMiK2h0dHBz"&gt;Titular&lt;/a&gt;',
    'Titular &lt;a href="https://news.google.com/rss/a',
    'Ley &amp; Orden &#8211; caso &#x201C;X&#x201D;',
    'Uno&nbsp;&nbsp;dos\n\n  tres',
    '5 &lt; 10 y 20 &gt; 3',
    'a &noexiste; b',
    'a &#1114112; b',
    '<!-- comentario -->Texto',
  ];

  it.each(FIXTURES)('coinciden las tres implementaciones para %j', (fixture) => {
    const expected = toPlainText(fixture);
    expect(clientToPlainText(fixture)).toBe(expected);
    expect(functionsToPlainText(fixture)).toBe(expected);
  });
});

describe('hasFeedMarkup', () => {
  it('detecta marcado escapado que quedó persistido', () => {
    expect(hasFeedMarkup('Titular &lt;a href="https://x.test"&gt;')).toBe(true);
  });

  it('no marca texto ya limpio, para no reescribir señales sanas', () => {
    expect(hasFeedMarkup('Top 7 Patent Tools in 2026 - TechBullion')).toBe(false);
  });

  it('no marca una comparación en texto legítimo', () => {
    expect(hasFeedMarkup('5 < 10 y 20 > 3')).toBe(false);
  });
});
