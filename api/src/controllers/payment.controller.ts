import type { RequestHandler } from 'express';
import * as paymentService from '../services/payment.service';
import { paymentIntentSchema } from '../validators/payment.schema';

export const getConfig: RequestHandler = (_req, res) => {
  res.json(paymentService.getPaymentConfig());
};

export const createIntent: RequestHandler = async (req, res) => {
  const { kind, bookingId } = paymentIntentSchema.parse(req.body);
  res.json(await paymentService.createPaymentIntent(req.user!, kind, bookingId));
};

export const listMine: RequestHandler = async (req, res) => {
  res.json(await paymentService.listMyPayments(req.user!));
};

export const adminList: RequestHandler = async (_req, res) => {
  res.json(await paymentService.listAllPayments());
};
