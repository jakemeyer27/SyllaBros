import type { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';

const secret = () => new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'syllabros-default-secret-set-in-prod'
);

export interface AuthedRequest extends Request { userId: string; }

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const { payload } = await jwtVerify(header.slice(7), secret());
    (req as AuthedRequest).userId = payload.sub as string;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
