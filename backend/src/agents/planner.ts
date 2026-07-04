import { isOffline } from '../config.js';
import { chat } from '../llm/openai.js';

/**
 * Planner agent — decomposes a research question into focused sub-queries.
 *
 * Each sub-query is meant to be independently answerable by retrieval, so the
 * retriever can gather targeted evidence and the synthesizer can cover the
 * question from multiple angles.
 */
export async function planResearch(question: string): Promise<string[]> {
  if (isOffline) {
    return mockPlan(question);
  }

  const system =
    'You are the planning agent in a research pipeline. Decompose the user\'s ' +
    'question into 3-5 focused, non-overlapping sub-queries that together fully ' +
    'cover it. Each sub-query should be self-contained and optimized for semantic ' +
    'document retrieval. Respond ONLY as JSON: {"subQueries": string[]}.';

  const raw = await chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: question },
    ],
    { json: true, temperature: 0.3 },
  );

  try {
    const parsed = JSON.parse(raw) as { subQueries?: unknown };
    if (Array.isArray(parsed.subQueries)) {
      const cleaned = parsed.subQueries
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        .map((s) => s.trim())
        .slice(0, 6);
      if (cleaned.length > 0) return cleaned;
    }
  } catch {
    // fall through to a safe default
  }
  return [question];
}

/**
 * Deterministic decomposition used offline. It expands the question along a few
 * classic analyst dimensions while always keeping the original question so
 * retrieval stays grounded in what was actually asked.
 */
function mockPlan(question: string): string[] {
  const q = question.trim().replace(/\?+$/, '');
  const lenses = [
    `${q}`,
    `Key facts, figures, and data about ${q}`,
    `Risks, challenges, or limitations related to ${q}`,
    `Recent developments and outlook for ${q}`,
  ];
  // De-duplicate while preserving order.
  return Array.from(new Set(lenses)).slice(0, 4);
}
