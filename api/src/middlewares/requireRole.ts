import type { RequestHandler } from 'express';
import type { Role } from '../types/user';
import { AppError } from '../utils/AppError';

export function requireRole(role: Role): RequestHandler {
  return (req, _res, next) => {
    if (req.user?.role !== role) {
      throw new AppError(403, 'FORBIDDEN', 'Accès réservé au rôle ' + role);
    }
    next();
  };
}
