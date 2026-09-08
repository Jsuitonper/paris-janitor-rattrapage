import type { RequestHandler } from 'express';
import * as userService from '../services/user.service';

export const me: RequestHandler = async (req, res) => {
  res.json(await userService.getUserById(req.user!.id));
};

export const listUsers: RequestHandler = async (_req, res) => {
  res.json(await userService.listUsers());
};
