import { Router } from 'express';
import { adminExportLeads, adminListLeads, adminQualifyLead } from '../../controllers/quoteSimulator.controller';

export const adminLeadsRouter = Router();

adminLeadsRouter.get('/', adminListLeads);
adminLeadsRouter.get('/export.csv', adminExportLeads);
adminLeadsRouter.patch('/:id', adminQualifyLead);
