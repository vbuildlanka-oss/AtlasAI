import { isOffline } from '../config.js';
import { chat } from '../llm/openai.js';
import type { Citation, RetrievedChunk } from '../types.js';

export interface SynthesisOutput {
  answer: string;
  citations: Citation[];
}

const NO_EVIDENCE_MESSAGE =
  'I could not find any ingested sources relevant to this question. ' +
  'Add documents, PDFs, or URLs to the workspace and ask again — Atlas only ' +
  'answers from grounded, cited evidence.';

/**
 * Synthesizer agent — composes the final answer from retrieved evidence.
 *
 * Hard rule: every claim must be grounded in the provided evidence and marked
 * with an inline [n] citation. Uncited claims are not allowed; if the evidence
 * doesn't support an answer, we say so rather than inventing one.
 */
export async function synthesize(
  question: string,
  evidence: RetrievedChunk[],
): Promise<SynthesisOutput> {
  if (evidence.length === 0) {
    return { answer: NO_EVIDENCE_MESSAGE, citations: [] };
  }

  const answer = isOffline
    ? mockSynthesize(question, evidence)
    : await llmSynthesize(question, evidence);

  const citations = buildCitations(answer, evidence);
  return { answer, citations };
}

/** Render the numbered evidence block the synthesizer is allowed to cite. */
function renderEvidence(evidence: RetrievedChunk[]): string {
  return evidence
    .map((c, i) => `[${i + 1}] (source: "${c.documentTitle}")\n${c.content}`)
    .join('\n\n');
}

async function llmSynthesize(question: string, evidence: RetrievedChunk[]): Promise<string> {
  const system =
    'You are the synthesis agent in a citation-grounded research system. ' +
    'Answer the question using ONLY the numbered evidence provided. ' +
    'Every sentence that makes a factual claim MUST end with one or more inline ' +
    'citations in the form [n], where n is the evidence number it is drawn from. ' +
    'Never state a fact that is not supported by the evidence. If the evidence is ' +
    'insufficient, say so explicitly. Write a clear, analyst-grade answer in prose.';

  const user =
    `QUESTION:\n${question}\n\n` +
    `EVIDENCE:\n${renderEvidence(evidence)}\n\n` +
    'Write the grounded, fully-cited answer now.';

  return (
    await chat(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      { temperature: 0.2 },
    )
  ).trim();
}

/**
 * Deterministic offline synthesis. Produces a readable, fully-cited answer by
 * summarizing the most relevant evidence chunks, one grounded claim each.
 */
function mockSynthesize(question: string, evidence: RetrievedChunk[]): string {
  const top = evidence.slice(0, 5);
  const claims = top
    .map((chunk, i) => {
      const sentence = leadingSentence(chunk.content);
      return `${sentence} [${i + 1}]`;
    })
    .join(' ');

  const intro = `Drawing on ${top.length} source${top.length > 1 ? 's' : ''} relevant to "${question.trim()}", the evidence indicates the following.`;
  const outro =
    'Every statement above is grounded in the cited source chunks; hover a ' +
    'citation to inspect the exact passage it was drawn from.';

  return `${intro} ${claims} ${outro}`;
}

/** Take a clean, self-contained opening sentence (or clause) from a chunk. */
function leadingSentence(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, ' ');
  const match = trimmed.match(/^(.{40,240}?[.!?])(\s|$)/);
  let sentence = match ? match[1] : trimmed.slice(0, 200);
  if (!/[.!?]$/.test(sentence)) sentence = sentence.replace(/[,;:]?\s*$/, '') + '.';
  return sentence;
}

/**
 * Parse the answer for [n] markers and map each to its evidence chunk, recording
 * the character span so the UI can highlight/link precisely. Only markers that
 * actually appear in the text become citations, and each (marker) is emitted
 * once with its first span.
 */
function buildCitations(answer: string, evidence: RetrievedChunk[]): Citation[] {
  const citations: Citation[] = [];
  const seen = new Set<number>();
  const regex = /\[(\d+)\]/g;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(answer)) !== null) {
    const marker = Number(m[1]);
    const chunk = evidence[marker - 1];
    if (!chunk || seen.has(marker)) continue;
    seen.add(marker);
    citations.push({
      marker,
      chunkId: chunk.id,
      documentId: chunk.documentId,
      documentTitle: chunk.documentTitle,
      sourceUrl: chunk.sourceUrl,
      snippet: chunk.content.slice(0, 500),
    });
  }

  return citations.sort((a, b) => a.marker - b.marker);
}
