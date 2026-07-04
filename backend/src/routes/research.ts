import { Router } from 'express';
import { runResearch } from '../agents/pipeline.js';
import type { AgentEvent } from '../types.js';

export const researchRouter = Router();

/**
 * Synchronous research: run the whole pipeline and return the final result.
 * POST /api/research  { question: string }
 */
researchRouter.post('/', async (req, res, next) => {
  try {
    const { question, userId } = req.body ?? {};
    if (typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ error: 'Field "question" is required.' });
    }
    const result = await runResearch(question.trim(), { userId });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * Streaming research via Server-Sent Events. Emits one event per agent stage
 * (planning/retrieving/synthesizing/saving) and a final "result" event.
 * GET /api/research/stream?question=...
 */
researchRouter.get('/stream', async (req, res) => {
  const question = String(req.query.question ?? '').trim();
  const userId = req.query.userId ? String(req.query.userId) : undefined;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  if (!question) {
    send('error', { message: 'Query parameter "question" is required.' });
    return res.end();
  }

  const emit = (evt: AgentEvent) => send('status', evt);

  try {
    const result = await runResearch(question, { userId, emit });
    send('result', result);
  } catch (err) {
    send('error', { message: err instanceof Error ? err.message : 'Research failed.' });
  } finally {
    res.end();
  }
});
