import { handleParseResume, handleTailor, handleAgent } from '../local-server.mjs';

export default async function handler(req, res) {
  const route = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname;

  try {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Method not allowed.' }));
      return;
    }

    if (route === '/api/parse-resume') return handleParseResume(req, res);
    if (route === '/api/tailor') return handleTailor(req, res);
    if (route === '/api/agent') return handleAgent(req, res);

    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'API route not found.' }));
  } catch (error) {
    console.error('Vercel API error:', error);
    res.statusCode = Number(error?.status) || 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: error?.message || 'Server error.' }));
  }
}
