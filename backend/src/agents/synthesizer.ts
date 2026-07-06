import { config } from '../config.js';
import { chat } from '../llm/client.js';
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

  const answer = config.llm.chat.enabled
    ? await llmSynthesize(question, evidence)
    : mockSynthesize(question, evidence);

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
  const seen = new Set<string>();
  const claims = top
    .map((chunk, i) => {
      // Pick the sentence that best answers the question, not just the first one.
      const sentence = bestSentence(chunk.content, question);
      const key = sentence.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      return `${sentence} [${i + 1}]`;
    })
    .filter((c): c is string => c !== null)
    .join(' ');

  const intro = `Drawing on ${top.length} source${top.length > 1 ? 's' : ''} relevant to "${question.trim()}", the evidence indicates the following.`;
  const outro =
    'Every statement above is grounded in the cited source chunks; hover a ' +
    'citation to inspect the exact passage it was drawn from.';

  return `${intro} ${claims} ${outro}`;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'of', 'to', 'in', 'on',
  'for', 'and', 'or', 'how', 'what', 'which', 'does', 'do', 'did', 'much', 'many',
  'it', 'its', 'this', 'that', 'with', 'as', 'at', 'by', 'from', 'about', 'can', 'per',
]);

/** Lowercase, drop punctuation/stopwords, and lightly stem trailing plural 's'. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t));
}

function splitSentences(content: string): string[] {
  return content
    .trim()
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Questions that are really asking for a figure (a quantity, price, date, …).
const QUANTITATIVE_RE =
  /\b(how much|how many|how fast|how long|how far|how old|how big|how heavy|when|what year|rate|cost|costs|price|priced|percent|percentage|number of|amount|speed|capacity|weight|size|duration)\b/i;

/** Numeric tokens in a piece of text (e.g. "500", "1", "200"). */
function numbersIn(text: string): string[] {
  return (text.toLowerCase().match(/\d+/g) ?? []);
}

/**
 * Choose the sentence in a chunk that best answers the question (offline mode).
 *
 * Scoring = keyword overlap, plus — for quantitative questions ("how much",
 * "cost", "when", …) — a strong bonus for sentences that introduce a NEW number
 * not already in the question. That way "how much water does it pump?" surfaces
 * "It can pump 500 liters per hour" instead of the definition sentence, even
 * though the definition shares more words. Falls back to the leading sentence.
 */
function bestSentence(content: string, question: string): string {
  const sentences = splitSentences(content);
  if (sentences.length === 0) return finalize(content.slice(0, 200));

  const qWords = new Set(tokenize(question));
  const qNumbers = new Set(numbersIn(question));
  const wantsNumber = QUANTITATIVE_RE.test(question);

  let best = sentences[0];
  let bestScore = -Infinity;
  for (const s of sentences) {
    const overlap = tokenize(s).reduce((acc, w) => acc + (qWords.has(w) ? 1 : 0), 0);
    const hasNewNumber = numbersIn(s).some((n) => !qNumbers.has(n));
    const numberBonus = wantsNumber && hasNewNumber ? 4 : 0;
    const score = overlap + numberBonus;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return finalize(best);
}

/** Clean a sentence into a self-contained, punctuated claim. */
function finalize(sentence: string): string {
  let s = sentence.trim().replace(/\s+/g, ' ').slice(0, 240);
  if (!/[.!?]$/.test(s)) s = s.replace(/[,;:]?\s*$/, '') + '.';
  return s;
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
