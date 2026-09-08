import { Router } from 'express';
import { getOne, listMine } from '../controllers/invoice.controller';
import { requireAuth } from '../middlewares/requireAuth';

export const invoiceRouter = Router();

invoiceRouter.use(requireAuth);
invoiceRouter.get('/', listMine);
invoiceRouter.get('/:id', getOne);
