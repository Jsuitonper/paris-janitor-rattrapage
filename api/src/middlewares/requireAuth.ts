import type { Request, RequestHandler } from 'express';
import { authenticate } from '../services/auth.service';
import { AppError } from '../utils/AppError';

const BEARER = 'Bearer ';

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization ?? '';
  return header.startsWith(BEARER) ? header.slice(BEARER.length) : null;
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = extractBearerToken(req);
  if (!token) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Jeton manquant');
  }
  req.user = await authenticate(token);
  next();
};
