// Vercel serverless function: vercel.json rewrites every /api/* request here
// (except the legacy
// /api/agent, /api/parse-resume and /api/tailor files next to this one).
// It runs the compiled Express app from `npm run build` (build/server).
import handler from '../build/server/src/vercel.js';

export default handler;
