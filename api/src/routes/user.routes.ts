import { Router } from 'express';
import { me } from '../controllers/user.controller';
import { requireAuth } from '../middlewares/requireAuth';

export const userRouter = Router();

userRouter.get('/me', requireAuth, me);
