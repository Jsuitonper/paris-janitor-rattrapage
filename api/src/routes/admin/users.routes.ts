import { Router } from 'express';
import { listUsers } from '../../controllers/user.controller';

export const adminUsersRouter = Router();

adminUsersRouter.get('/', listUsers);
