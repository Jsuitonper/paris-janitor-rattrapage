import type { RequestHandler } from 'express';
import { authenticate } from '../services/auth.service';
import { extractBearerToken } from './requireAuth';

export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const token = extractBearerToken(req);
  if (token) {
    req.user = await authenticate(token);
  }
  next();
};
