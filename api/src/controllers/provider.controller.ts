import type { RequestHandler } from 'express';
import * as providerService from '../services/provider.service';
import { providerPatchSchema, providerSchema } from '../validators/catalog.schema';

export const listProviders: RequestHandler = async (_req, res) => {
  res.json(await providerService.listProviders());
};

export const getProvider: RequestHandler = async (req, res) => {
  res.json(await providerService.getProvider(req.params.id as string));
};

export const createProvider: RequestHandler = async (req, res) => {
  res.status(201).json(await providerService.createProvider(providerSchema.parse(req.body)));
};

export const updateProvider: RequestHandler = async (req, res) => {
  res.json(await providerService.updateProvider(req.params.id as string, providerPatchSchema.parse(req.body)));
};

export const deleteProvider: RequestHandler = async (req, res) => {
  await providerService.removeProvider(req.params.id as string);
  res.status(204).end();
};
