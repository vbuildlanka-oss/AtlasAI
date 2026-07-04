import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { config, isOffline } from './config.js';
import { healthcheck } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { documentsRouter } from './routes/documents.js';
import { sessionsRouter } from './routes/sessions.js';
import { researchRouter } from './routes/research.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// backend/dist/index.js -> repo-root/frontend/dist
const frontendDist = path.resolve(__dirname, '../../frontend/dist');

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

// In single-service deployments the API also serves the built React app.
const serveFrontend = config.serveFrontend && existsSync(frontendDist);
if (serveFrontend) {
  app.use(express.static(frontendDist));
  // SPA fallback: any non-API route returns index.html so client routing works.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Central error handler.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[error]', err);
  const message = err instanceof Error ? err.message : 'Internal server error.';
  res.status(500).json({ error: message });
});

async function start() {
  // On a fresh deploy, self-initialize the schema (idempotent — all IF NOT EXISTS).
  if (config.autoMigrate) {
    try {
      await migrate();
    } catch (err) {
      console.error('[startup] auto-migration failed (continuing):', err instanceof Error ? err.message : err);
    }
  }

  app.listen(config.port, () => {
    console.log(`\n🛰  Atlas Intelligence listening on port ${config.port}`);
    console.log(`   Mode:     ${isOffline ? 'OFFLINE MOCK (no OpenAI key)' : 'OpenAI (' + config.openai.chatModel + ')'}`);
    console.log(`   Frontend: ${serveFrontend ? 'served from this service' : 'run separately (vite dev)'}`);
    console.log(`   DB:       ${config.databaseUrl.replace(/:[^:@/]+@/, ':****@')} (ssl: ${config.databaseSsl})\n`);
  });
}

start();
