import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError';

export type RateLimiter = RequestHandler & { reset: () => void };

export function rateLimit(options: { windowMs: number; max: number; message?: string }): RateLimiter {
  const hits = new Map<string, number[]>();

  const middleware: RequestHandler = (req, _res, next) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((timestamp) => now - timestamp < options.windowMs);

    if (recent.length >= options.max) {
      hits.set(key, recent);
      throw new AppError(429, 'RATE_LIMITED', options.message ?? 'Trop de requêtes, réessayez dans un instant');
    }

    recent.push(now);
    hits.set(key, recent);
    next();
  };

  return Object.assign(middleware, { reset: () => hits.clear() });
}
