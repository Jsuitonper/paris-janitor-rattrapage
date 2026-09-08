import { Router } from 'express';
import {
  adminListServices,
  adminListStays,
  adminSetServiceStatus,
  adminSetStayStatus,
} from '../../controllers/booking.controller';

export const adminBookingsRouter = Router();

adminBookingsRouter.get('/stays', adminListStays);
adminBookingsRouter.patch('/stays/:id/status', adminSetStayStatus);
adminBookingsRouter.get('/services', adminListServices);
adminBookingsRouter.patch('/services/:id/status', adminSetServiceStatus);
