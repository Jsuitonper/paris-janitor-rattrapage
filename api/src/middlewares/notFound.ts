import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', `Route introuvable : ${req.method} ${req.originalUrl}`));
};
