import type { RequestHandler } from 'express';
import { healthStatus } from '../services/health.service';

export const getHealth: RequestHandler = (_req, res) => {
  res.json(healthStatus());
};
