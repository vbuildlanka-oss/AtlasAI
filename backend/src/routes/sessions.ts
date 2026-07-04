import { Router } from 'express';
import { pool } from '../db/pool.js';
import { asyncHandler } from './asyncHandler.js';

export const sessionsRouter = Router();

/** List past research sessions (most recent first). */
sessionsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const result = await pool.query(
      `SELECT s.id, s.question, s.user_id, s.created_at,
              a.id AS answer_id
       FROM sessions s
       LEFT JOIN answers a ON a.session_id = s.id
       ORDER BY s.created_at DESC
       LIMIT 100`,
    );
    res.json({ sessions: result.rows });
  }),
);

/** Fetch a full session: question, answer, plan, and reconstructed citations. */
sessionsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const sessionRes = await pool.query(
      'SELECT id, question, user_id, created_at FROM sessions WHERE id = $1',
      [req.params.id],
    );
    if (sessionRes.rowCount === 0) return res.status(404).json({ error: 'Session not found.' });
    const session = sessionRes.rows[0];

    const answerRes = await pool.query(
      `SELECT id, content, plan, created_at FROM answers
       WHERE session_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [session.id],
    );
    const answer = answerRes.rows[0] ?? null;

    let citations: unknown[] = [];
    if (answer) {
      const citRes = await pool.query(
        `SELECT ct.marker, ct.span_start, ct.span_end,
                ch.id AS chunk_id, ch.content, ch.document_id,
                d.title AS document_title, d.source_url
         FROM citations ct
         JOIN chunks ch ON ch.id = ct.chunk_id
         JOIN documents d ON d.id = ch.document_id
         WHERE ct.answer_id = $1
         ORDER BY ct.marker ASC`,
        [answer.id],
      );
      citations = citRes.rows.map((r) => ({
        marker: r.marker,
        chunkId: r.chunk_id,
        documentId: r.document_id,
        documentTitle: r.document_title,
        sourceUrl: r.source_url,
        snippet: (r.content as string).slice(0, 500),
        spanStart: r.span_start,
        spanEnd: r.span_end,
      }));
    }

    res.json({ session, answer, citations });
  }),
);
