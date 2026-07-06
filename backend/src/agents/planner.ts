import { config } from '../config.js';
import { chat } from '../llm/client.js';

/**
 * Planner agent — decomposes a research question into focused sub-queries.
 *
 * Each sub-query is meant to be independently answerable by retrieval, so the
 * retriever can gather targeted evidence and the synthesizer can cover the
 * question from multiple angles.
 */
export async function planResearch(question: string): Promise<string[]> {
  if (!config.llm.chat.enabled) {
    return mockPlan(question);
  }

  const system =
    'You are the planning agent in a research pipeline. Decompose the user\'s ' +
    'question into 3-5 focused, non-overlapping sub-queries that together fully ' +
    'cover it. Each sub-query should be self-contained and optimized for semantic ' +
    'document retrieval. Respond ONLY as JSON: {"subQueries": string[]}.';

  try {
    const raw = await chat(
      [
        { role: 'system', content: system },
        { role: 'user', content: question },
      ],
      { json: true, temperature: 0.3 },
    );

    const parsed = JSON.parse(raw) as { subQueries?: unknown };
    if (Array.isArray(parsed.subQueries)) {
      const cleaned = parsed.subQueries
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        .map((s) => s.trim())
        .slice(0, 6);
      if (cleaned.length > 0) return cleaned;
    }
  } catch (err) {
    // Planning is non-critical: if the provider errors or returns bad JSON,
    // degrade to the deterministic plan rather than failing the whole request.
    console.warn('[planner] falling back to mock plan:', err instanceof Error ? err.message : err);
    return mockPlan(question);
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
