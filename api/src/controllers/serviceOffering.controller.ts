import type { RequestHandler } from 'express';
import * as offeringService from '../services/serviceOffering.service';
import { offeringPatchSchema, offeringSchema } from '../validators/catalog.schema';

export const listOfferings: RequestHandler = async (_req, res) => {
  res.json(await offeringService.listOfferings());
};

export const getOffering: RequestHandler = async (req, res) => {
  res.json(await offeringService.getOffering(req.params.id as string));
};

export const createOffering: RequestHandler = async (req, res) => {
  res.status(201).json(await offeringService.createOffering(offeringSchema.parse(req.body)));
};

export const updateOffering: RequestHandler = async (req, res) => {
  res.json(await offeringService.updateOffering(req.params.id as string, offeringPatchSchema.parse(req.body)));
};

export const deleteOffering: RequestHandler = async (req, res) => {
  await offeringService.removeOffering(req.params.id as string);
  res.status(204).end();
};
