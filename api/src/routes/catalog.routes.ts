import { Router } from 'express';
import {
  getOffering,
  getProperty,
  getPropertyAvailability,
  listCategories,
  listOfferings,
  listProperties,
  listOfferingReviews,
  listVipPlans,
} from '../controllers/catalog.controller';
import { optionalAuth } from '../middlewares/optionalAuth';

export const catalogRouter = Router();

catalogRouter.get('/properties', listProperties);
catalogRouter.get('/properties/:id', getProperty);
catalogRouter.get('/properties/:id/availability', getPropertyAvailability);
catalogRouter.get('/categories', listCategories);
catalogRouter.get('/offerings', optionalAuth, listOfferings);
catalogRouter.get('/offerings/:id', optionalAuth, getOffering);
catalogRouter.get('/offerings/:id/reviews', listOfferingReviews);
catalogRouter.get('/vip-plans', listVipPlans);
