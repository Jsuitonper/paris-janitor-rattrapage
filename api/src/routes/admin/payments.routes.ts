import { Router } from 'express';
import { adminList } from '../../controllers/payment.controller';

export const adminPaymentsRouter = Router();

adminPaymentsRouter.get('/', adminList);
