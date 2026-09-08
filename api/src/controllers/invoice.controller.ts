import type { RequestHandler } from 'express';
import * as invoiceService from '../services/invoice.service';
import * as providerPayoutService from '../services/providerPayout.service';
import { invoiceListQuerySchema, payoutStatusSchema, providerPayoutSchema } from '../validators/file.schema';

export const listMine: RequestHandler = async (req, res) => {
  res.json(await invoiceService.listMyInvoices(req.user!));
};

export const getOne: RequestHandler = async (req, res) => {
  res.json(await invoiceService.getInvoice(req.params.id as string, req.user!));
};

export const adminList: RequestHandler = async (req, res) => {
  res.json(await invoiceService.listAllInvoices(invoiceListQuerySchema.parse(req.query).type));
};

export const generateProviderInvoices: RequestHandler = async (req, res) => {
  const period = providerPayoutSchema.parse(req.body);
  res.status(201).json(await providerPayoutService.generateProviderInvoices(period));
};

export const setPayoutStatus: RequestHandler = async (req, res) => {
  const { payoutStatus } = payoutStatusSchema.parse(req.body);
  res.json(await providerPayoutService.setPayoutStatus(req.params.id as string, payoutStatus));
};
