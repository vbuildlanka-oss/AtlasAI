// Turn raw sources (plain text, PDF bytes, or a URL) into clean text + a title.

export interface ExtractedSource {
  title: string;
  text: string;
  sourceUrl: string | null;
  sourceType: 'text' | 'pdf' | 'url';
}

/** Extract readable text from a PDF buffer. */
export async function extractPdf(buffer: Buffer, filename?: string): Promise<ExtractedSource> {
  // Dynamic import keeps pdf-parse's module-load side effects out of startup.
  const mod = await import('pdf-parse');
  const pdfParse = (mod.default ?? mod) as (b: Buffer) => Promise<{ text: string; info?: any }>;
  const parsed = await pdfParse(buffer);
  const title =
    (parsed.info && (parsed.info.Title as string)) ||
    filename?.replace(/\.pdf$/i, '') ||
    'Untitled PDF';
  return {
    title: title.trim() || 'Untitled PDF',
    text: normalize(parsed.text),
    sourceUrl: null,
    sourceType: 'pdf',
  };
}

/** Fetch a URL and reduce the HTML to readable text. */
export async function extractUrl(url: string): Promise<ExtractedSource> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AtlasIntelligence/0.1 (+research-workspace)' },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const contentType = res.headers.get('content-type') ?? '';
  const body = await res.text();

  if (contentType.includes('text/html')) {
    const title = extractHtmlTitle(body) ?? url;
    return { title, text: htmlToText(body), sourceUrl: url, sourceType: 'url' };
  }
  // Plain text / markdown / json served over HTTP.
  return { title: url, text: normalize(body), sourceUrl: url, sourceType: 'url' };
}

export function extractText(text: string, title?: string): ExtractedSource {
  const clean = normalize(text);
  const derivedTitle = title?.trim() || firstLineTitle(clean) || 'Pasted note';
  return { title: derivedTitle, text: clean, sourceUrl: null, sourceType: 'text' };
}

// --- helpers ---------------------------------------------------------------

function normalize(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function firstLineTitle(text: string): string | null {
  const line = text.split('\n').find((l) => l.trim().length > 0);
  if (!line) return null;
  return line.trim().slice(0, 120);
}

function extractHtmlTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1].trim()).slice(0, 200) : null;
}

/** Strip scripts/styles/tags and collapse whitespace into readable prose. */
export function htmlToText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const withBreaks = withoutScripts
    .replace(/<\/(p|div|section|article|h[1-6]|li|br|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');

  const text = withBreaks.replace(/<[^>]+>/g, ' ');
  return normalize(decodeEntities(text));
}

function decodeEntities(str: string): string {
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
