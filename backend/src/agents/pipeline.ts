import { pool } from '../db/pool.js';
import { config } from '../config.js';
import { planResearch } from './planner.js';
import { consolidateEvidence, retrieveForPlan } from './retriever.js';
import { synthesize } from './synthesizer.js';
import type { AgentEvent, Citation, ResearchResult } from '../types.js';

export type EventEmitter = (event: AgentEvent) => void;

const noop: EventEmitter = () => {};

/**
 * Run the full research pipeline for a question and persist the result.
 *
 *   planner → retrievers (parallel) → synthesizer → save
 *
 * `emit` receives staged progress events so callers can stream live status to
 * the UI (which agent is currently working).
 */
export async function runResearch(
  question: string,
  opts: { userId?: string; emit?: EventEmitter } = {},
): Promise<ResearchResult> {
  const emit = opts.emit ?? noop;
  const userId = opts.userId ?? 'anonymous';
  const mode = config.llm.chat.enabled ? config.llm.chat.provider : 'offline mock';

  try {
    // 1. Plan -------------------------------------------------------------
    emit({ stage: 'planning', message: `Planner (${mode}) is decomposing the question…` });
    const plan = await planResearch(question);
    emit({ stage: 'planning', message: `Planned ${plan.length} sub-queries.`, detail: plan });

    // 2. Retrieve ---------------------------------------------------------
    emit({ stage: 'retrieving', message: `Retrieving evidence for ${plan.length} sub-queries…` });
    const perQuery = await retrieveForPlan(plan);
    const evidence = consolidateEvidence(perQuery);
    emit({
      stage: 'retrieving',
      message: `Retrieved ${evidence.length} unique source chunks.`,
      detail: { perQuery: perQuery.map((r) => ({ subQuery: r.subQuery, hits: r.chunks.length })) },
    });

    // 3. Synthesize -------------------------------------------------------
    emit({ stage: 'synthesizing', message: `Synthesizer (${mode}) is composing a cited answer…` });
    const { answer, citations } = await synthesize(question, evidence);
    emit({ stage: 'synthesizing', message: `Drafted answer with ${citations.length} citations.` });

    // 4. Persist ----------------------------------------------------------
    emit({ stage: 'saving', message: 'Saving session, answer, and provenance…' });
    const result = await persist({ userId, question, plan, answer, citations });

    emit({ stage: 'done', message: 'Research complete.', detail: { sessionId: result.sessionId } });
    return result;
  } catch (err) {
    emit({
      stage: 'error',
      message: err instanceof Error ? err.message : 'Unknown error during research.',
    });
    throw err;
  }
}

async function persist(input: {
  userId: string;
  question: string;
  plan: string[];
  answer: string;
  citations: Citation[];
}): Promise<ResearchResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sessionRes = await client.query(
      `INSERT INTO sessions (user_id, question) VALUES ($1, $2) RETURNING id, created_at`,
      [input.userId, input.question],
    );
    const sessionId: string = sessionRes.rows[0].id;

    const answerRes = await client.query(
      `INSERT INTO answers (session_id, content, plan) VALUES ($1, $2, $3) RETURNING id, created_at`,
      [sessionId, input.answer, JSON.stringify(input.plan)],
    );
    const answerId: string = answerRes.rows[0].id;
    const createdAt: string = answerRes.rows[0].created_at;

    // Record provenance: each inline marker → the exact chunk it came from.
    for (const c of input.citations) {
      const span = findSpan(input.answer, c.marker);
      await client.query(
        `INSERT INTO citations (answer_id, chunk_id, marker, span_start, span_end)
         VALUES ($1, $2, $3, $4, $5)`,
        [answerId, c.chunkId, c.marker, span.start, span.end],
      );
    }

    await client.query('COMMIT');

    return {
      sessionId,
      answerId,
      question: input.question,
      plan: input.plan,
      answer: input.answer,
      citations: input.citations,
      createdAt,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function findSpan(answer: string, marker: number): { start: number; end: number } {
  const idx = answer.indexOf(`[${marker}]`);
  if (idx === -1) return { start: 0, end: 0 };
  return { start: idx, end: idx + `[${marker}]`.length };
}
