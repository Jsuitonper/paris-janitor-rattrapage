import { Router } from 'express';
import {
  createProvider,
  deleteProvider,
  getProvider,
  listProviders,
  updateProvider,
} from '../../controllers/provider.controller';

export const adminProvidersRouter = Router();

adminProvidersRouter.get('/', listProviders);
adminProvidersRouter.post('/', createProvider);
adminProvidersRouter.get('/:id', getProvider);
adminProvidersRouter.patch('/:id', updateProvider);
adminProvidersRouter.delete('/:id', deleteProvider);
