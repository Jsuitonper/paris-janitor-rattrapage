import { Router } from 'express';
import {
  createOffering,
  deleteOffering,
  getOffering,
  listOfferings,
  updateOffering,
} from '../../controllers/serviceOffering.controller';

export const adminOfferingsRouter = Router();

adminOfferingsRouter.get('/', listOfferings);
adminOfferingsRouter.post('/', createOffering);
adminOfferingsRouter.get('/:id', getOffering);
adminOfferingsRouter.patch('/:id', updateOffering);
adminOfferingsRouter.delete('/:id', deleteOffering);
