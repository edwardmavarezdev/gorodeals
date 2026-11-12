/**
 * Conversor de markdown minimo a HTML para el cuerpo de las publicaciones.
 *
 * El texto viene de nuestra propia API (contenido editorial), pero se escapa
 * siempre antes de transformarse: nada de HTML incrustado en el articulo.
 *
 * Sintaxis admitida:
 * - `## Titulo` y `### Subtitulo`
 * - `- elemento` y `1. elemento` (listas)
 * - `> cita`
 * - `**negrita**`, `*cursiva*` y `` `codigo` ``
 * - `[texto](url)` con url http(s) o relativa
 * - parrafos separados por linea en blanco
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

function safeHref(url: string): string | null {
  const trimmed = url.trim();
  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith('/')) {
    return trimmed;
  }
  return null;
}

/** Aplica el formato en linea a un texto ya escapado. */
function inline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, href: string) => {
      const url = safeHref(href);
      if (!url) return match;
      return `<a href="${escapeHtml(url)}" rel="noopener noreferrer">${label}</a>`;
    });
}

export function renderMarkdown(source: string | null | undefined): string {
  if (!source) return '';

  const lines = escapeHtml(source).split(/\r?\n/);
  const html: string[] = [];
  let paragraph: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let quote: string[] = [];
  /** Ultimo elemento de lista abierto, para continuar lineas envueltas. */
  let openListItem: { index: number; html: string } | null = null;

  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      html.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };

  const flushList = (): void => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
    openListItem = null;
  };

  /** Continua el ultimo elemento de lista con la linea actual. */
  const continueListItem = (line: string): boolean => {
    if (!openListItem) return false;
    const continued = `${openListItem.html} ${inline(line)}`;
    html[openListItem.index] = continued;
    openListItem.html = continued;
    return true;
  };

  const flushQuote = (): void => {
    if (quote.length > 0) {
      html.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);
      quote = [];
    }
  };

  const flushAll = (): void => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.trim() === '') {
      flushAll();
      continue;
    }

    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (line.startsWith('> ')) {
      flushParagraph();
      flushList();
      quote.push(line.slice(2));
      continue;
    }
    flushQuote();

    const unordered = /^[-*]\s+(.*)$/.exec(line);
    if (unordered) {
      flushParagraph();
      if (listType !== 'ul') {
        flushList();
        html.push('<ul>');
        listType = 'ul';
      }
      const itemHtml = `<li>${inline(unordered[1])}</li>`;
      html.push(itemHtml);
      openListItem = { index: html.length - 1, html: itemHtml };
      continue;
    }

    const ordered = /^\d+\.\s+(.*)$/.exec(line);
    if (ordered) {
      flushParagraph();
      if (listType !== 'ol') {
        flushList();
        html.push('<ol>');
        listType = 'ol';
      }
      const itemHtml = `<li>${inline(ordered[1])}</li>`;
      html.push(itemHtml);
      openListItem = { index: html.length - 1, html: itemHtml };
      continue;
    }

    // Una linea suelta dentro de una lista continua el ultimo elemento.
    if (continueListItem(line.trim())) continue;

    flushList();
    paragraph.push(line.trim());
  }

  flushAll();
  return html.join('\n');
}
