import type { RequestHandler } from 'express';
import * as authService from '../services/auth.service';
import { loginSchema, registerSchema } from '../validators/auth.schema';

export const register: RequestHandler = async (req, res) => {
  const { email, password, ...profile } = registerSchema.parse(req.body);
  const result = await authService.register({ email, password, profile });
  res.status(201).json(result);
};

export const login: RequestHandler = async (req, res) => {
  const body = loginSchema.parse(req.body);
  res.json(await authService.login(body));
};
