import type { CanvasBlock } from '../types';

/**
 * Serialize the canvas to a self-contained Markdown research brief, preserving
 * inline citations and a full source list for each answer (the audit trail).
 */
export function canvasToMarkdown(blocks: CanvasBlock[]): string {
  const lines: string[] = ['# Atlas Intelligence — Research Brief', ''];
  lines.push(`_Exported ${new Date().toLocaleString()}_`, '');

  // Order top-to-bottom, then left-to-right, roughly matching the visual layout.
  const ordered = [...blocks].sort((a, b) => a.y - b.y || a.x - b.x);

  for (const block of ordered) {
    if (block.kind === 'answer' && block.result) {
      lines.push(`## ${block.result.question}`, '');
      lines.push(block.result.answer, '');
      if (block.result.citations.length) {
        lines.push('### Sources', '');
        for (const c of block.result.citations) {
          const src = c.sourceUrl ? `${c.documentTitle} (${c.sourceUrl})` : c.documentTitle;
          lines.push(`- [${c.marker}] ${src}`);
          lines.push(`  > ${c.snippet.replace(/\n+/g, ' ').slice(0, 300)}`);
        }
        lines.push('');
      }
    } else if (block.kind === 'note') {
      lines.push(`## Note: ${block.title}`, '', block.text ?? '', '');
    } else if (block.kind === 'source' && block.document) {
      const d = block.document;
      lines.push(`## Source: ${d.title}`, '');
      lines.push(`- Type: ${d.source_type}`);
      if (d.source_url) lines.push(`- URL: ${d.source_url}`);
      lines.push(`- Chunks indexed: ${d.chunk_count}`, '');
    }
  }

  return lines.join('\n');
}

export function downloadMarkdown(content: string, filename = 'atlas-research-brief.md') {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
