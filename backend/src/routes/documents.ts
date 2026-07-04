import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db/pool.js';
import { ingestSource } from '../ingestion/ingest.js';
import { extractPdf, extractText, extractUrl } from '../ingestion/extractors.js';
import { asyncHandler } from './asyncHandler.js';
import type { DocumentRow } from '../types.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export const documentsRouter = Router();

/** List ingested documents with their chunk counts. */
documentsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const result = await pool.query(
      `SELECT d.*, COUNT(c.id)::int AS chunk_count
       FROM documents d
       LEFT JOIN chunks c ON c.document_id = d.id
       GROUP BY d.id
       ORDER BY d.ingested_at DESC`,
    );
    res.json({ documents: result.rows });
  }),
);

/** Ingest pasted / raw text. */
documentsRouter.post(
  '/text',
  asyncHandler(async (req, res) => {
    const { text, title } = req.body ?? {};
    if (typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({ error: 'Field "text" is required.' });
      return;
    }
    const source = extractText(text, typeof title === 'string' ? title : undefined);
    const result = await ingestSource(source);
    res.status(201).json(result);
  }),
);

/** Ingest a URL (fetches + strips HTML). */
documentsRouter.post(
  '/url',
  asyncHandler(async (req, res) => {
    const { url } = req.body ?? {};
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      res.status(400).json({ error: 'A valid http(s) "url" is required.' });
      return;
    }
    const source = await extractUrl(url);
    const result = await ingestSource(source, { fetchedFrom: url });
    res.status(201).json(result);
  }),
);

/** Ingest an uploaded PDF (multipart form field "file"). */
documentsRouter.post(
  '/upload',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'A PDF file is required (field "file").' });
      return;
    }
    const source = await extractPdf(req.file.buffer, req.file.originalname);
    const result = await ingestSource(source, {
      originalName: req.file.originalname,
      sizeBytes: req.file.size,
    });
    res.status(201).json(result);
  }),
);

/** Delete a document and its chunks (cascade). */
documentsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await pool.query<DocumentRow>(
      'DELETE FROM documents WHERE id = $1 RETURNING id',
      [req.params.id],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }
    res.json({ deleted: result.rows[0].id });
  }),
);
