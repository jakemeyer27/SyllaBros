import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import 'dotenv/config';

const NEON_AUTH_URL = process.env.NEON_AUTH_URL_INTERNAL
  ?? process.env.VITE_NEON_AUTH_URL
  ?? 'https://ep-old-bread-aktl98pt.neonauth.c-3.us-west-2.aws.neon.tech/neondb/auth';

// Neon Auth exposes its public keys at /.well-known/jwks.json
const JWKS = createRemoteJWKSet(
  new URL(`${NEON_AUTH_URL}/.well-known/jwks.json`)
);

export interface AuthedRequest extends Request {
  userId: string;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }
  const token = header.slice(7);

  console.log('[auth] token preview:', token.slice(0, 40), '... length:', token.length);
  try {
    const { payload } = await jwtVerify(token, JWKS);
    console.log('[auth] verified, sub:', payload.sub);
    const userId = (payload.sub ?? (payload as Record<string,unknown>).id) as string | undefined;
    if (!userId) {
      res.status(401).json({ error: 'No user ID in token' });
      return;
    }
    (req as AuthedRequest).userId = userId;
    next();
  } catch (e) {
    console.error('[auth] JWT verify failed:', (e as Error).message);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
