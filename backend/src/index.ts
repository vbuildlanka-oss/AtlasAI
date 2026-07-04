import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { config, isOffline } from './config.js';
import { healthcheck } from './db/pool.js';
import { documentsRouter } from './routes/documents.js';
import { sessionsRouter } from './routes/sessions.js';
import { researchRouter } from './routes/research.js';

const app = express();

app.use(cors({ origin: config.corsOrigins.length ? config.corsOrigins : true }));
app.use(express.json({ limit: '5mb' }));

// Health / status — also reports whether we're in offline mock mode.
app.get('/api/health', async (_req, res) => {
  const db = await healthcheck();
  res.json({
    status: 'ok',
    db: db ? 'connected' : 'unavailable',
    mode: isOffline ? 'offline-mock' : 'openai',
    chatModel: isOffline ? null : config.openai.chatModel,
    embeddingModel: isOffline ? 'mock-hashing' : config.openai.embeddingModel,
  });
});

app.use('/api/documents', documentsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/research', researchRouter);

// Central error handler.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[error]', err);
  const message = err instanceof Error ? err.message : 'Internal server error.';
  res.status(500).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`\n🛰  Atlas Intelligence API listening on http://localhost:${config.port}`);
  console.log(`   Mode: ${isOffline ? 'OFFLINE MOCK (no OpenAI key)' : 'OpenAI (' + config.openai.chatModel + ')'}`);
  console.log(`   DB:   ${config.databaseUrl.replace(/:[^:@/]+@/, ':****@')}\n`);
});
