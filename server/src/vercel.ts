import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadConfig } from './config.js';
import { createStore } from './db/store.js';
import { createAIChain } from './ai/provider.js';
import { createApp } from './app.js';
import { logger } from './logger.js';

/**
 * Vercel serverless entry: the same Express app as `npm start`, created once
 * per warm function instance. The frontend (dist/) is served by Vercel's CDN.
 *
 * Production storage is Cloud Firestore (DATABASE_URL=firestore); a Postgres
 * URL also works. SQLite is not suitable on Vercel (no persistent disk).
 */
let ready: Promise<(req: IncomingMessage, res: ServerResponse) => void> | null = null;

async function build() {
  const config = loadConfig();
  if (!process.env.DATABASE_URL) config.databaseUrl = 'firestore';
  const store = await createStore(config.databaseUrl, config.firebase);
  await store.migrate();
  const ai = createAIChain(config.ai);
  const { app } = await createApp({ config, store, ai, legacy: false });
  logger.info('vercel.ready', { db: store.kind, ai: ai.names });
  return app as unknown as (req: IncomingMessage, res: ServerResponse) => void;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!ready) ready = build().catch((e) => {
    ready = null;
    throw e;
  });
  const app = await ready;
  return app(req, res);
}
