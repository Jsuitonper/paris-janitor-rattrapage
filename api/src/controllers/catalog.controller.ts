import type { RequestHandler } from 'express';
import * as catalogService from '../services/catalog.service';
import { catalogPropertyQuerySchema, objectIdSchema } from '../validators/catalog.schema';

export const listProperties: RequestHandler = async (req, res) => {
  const query = catalogPropertyQuerySchema.parse(req.query);
  res.json(await catalogService.listPublishedProperties({ arrondissement: query.arrondissement, minCapacity: query.capacity }));
};

export const getProperty: RequestHandler = async (req, res) => {
  res.json(await catalogService.getPublishedProperty(req.params.id as string));
};

export const listCategories: RequestHandler = async (_req, res) => {
  res.json(await catalogService.listCategories());
};

export const listOfferings: RequestHandler = async (req, res) => {
  const categoryId = req.query.categoryId === undefined ? undefined : objectIdSchema.parse(req.query.categoryId);
  res.json(await catalogService.listOfferings(req.user, categoryId));
};

export const getOffering: RequestHandler = async (req, res) => {
  res.json(await catalogService.getOffering(req.params.id as string, req.user));
};

export const listVipPlans: RequestHandler = async (_req, res) => {
  res.json(await catalogService.listVipPlans());
};

export const getPropertyAvailability: RequestHandler = async (req, res) => {
  res.json(await catalogService.getPropertyAvailability(req.params.id as string));
};

export const listOfferingReviews: RequestHandler = async (req, res) => {
  res.json(await catalogService.listOfferingReviews(req.params.id as string));
};
