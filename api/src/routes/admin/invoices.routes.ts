import { Router } from 'express';
import { adminList, generateProviderInvoices, setPayoutStatus } from '../../controllers/invoice.controller';

export const adminInvoicesRouter = Router();

adminInvoicesRouter.get('/', adminList);
adminInvoicesRouter.post('/provider-payouts', generateProviderInvoices);
adminInvoicesRouter.patch('/:id/payout', setPayoutStatus);
