import type { RequestHandler } from 'express';
import type { AppConfig } from '../config.js';
import { unauthorized } from '../errors.js';
import { logger } from '../logger.js';

/**
 * Verifies the Firebase ID token sent by the browser in `X-Firebase-Auth` and
 * exposes the user's uid as `req.uid`. Requests without the header continue as
 * guests (the service decides whether guests are allowed). When Firebase is
 * not configured the header is ignored.
 */
export function firebaseAuth(config: AppConfig, override?: (token: string) => Promise<{ uid: string }>): RequestHandler {
  if (!config.firebase.projectId && !override) return (_req, _res, next) => next();
  let verify: ((token: string) => Promise<{ uid: string }>) | null = override || null;
  const verifier = async () => {
    if (!verify) {
      const { getAuth } = await import('firebase-admin/auth');
      const { firebaseApp } = await import('../db/firestoreStore.js');
      const auth = getAuth(firebaseApp(config.firebase));
      verify = (t) => auth.verifyIdToken(t);
    }
    return verify;
  };
  return (req, _res, next) => {
    const token = req.get('x-firebase-auth');
    if (!token) return next();
    verifier()
      .then((v) => v(token))
      .then((decoded) => {
        (req as any).uid = decoded.uid;
        next();
      })
      .catch((e) => {
        // The reason (e.g. wrong project / audience, expired, bad signature) — never the token itself.
        logger.warn('auth.rejected', { code: e?.errorInfo?.code || e?.code, reason: String(e?.errorInfo?.message || e?.message || e).slice(0, 300) });
        const expired = /expired/i.test(String(e?.errorInfo?.code || e?.message));
        next(unauthorized(expired ? 'Your sign-in has expired. Please sign in again.' : 'Sign-in could not be verified by the server. Please sign out and sign in again; if it keeps happening, the server’s Firebase settings need checking.'));
      });
  };
}
