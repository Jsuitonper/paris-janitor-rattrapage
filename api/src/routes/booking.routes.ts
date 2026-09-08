import { Router } from 'express';
import {
  cancelService,
  cancelStay,
  createService,
  createStay,
  getService,
  getStay,
  listMine,
} from '../controllers/booking.controller';
import { requireAuth } from '../middlewares/requireAuth';

export const bookingRouter = Router();

bookingRouter.use(requireAuth);
bookingRouter.get('/', listMine);
bookingRouter.post('/stays', createStay);
bookingRouter.get('/stays/:id', getStay);
bookingRouter.post('/stays/:id/cancel', cancelStay);
bookingRouter.post('/services', createService);
bookingRouter.get('/services/:id', getService);
bookingRouter.post('/services/:id/cancel', cancelService);
