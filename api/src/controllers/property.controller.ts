import type { RequestHandler } from 'express';
import * as propertyService from '../services/property.service';
import {
  propertyListQuerySchema,
  propertyPatchSchema,
  propertySchema,
  propertyStatusSchema,
} from '../validators/catalog.schema';
import { AppError } from '../utils/AppError';

export const listProperties: RequestHandler = async (req, res) => {
  const query = propertyListQuerySchema.parse(req.query);
  res.json(await propertyService.listProperties({ status: query.status }));
};

export const getProperty: RequestHandler = async (req, res) => {
  res.json(await propertyService.getProperty(req.params.id as string));
};

export const createProperty: RequestHandler = async (req, res) => {
  res.status(201).json(await propertyService.createProperty(propertySchema.parse(req.body)));
};

export const updateProperty: RequestHandler = async (req, res) => {
  res.json(await propertyService.updateProperty(req.params.id as string, propertyPatchSchema.parse(req.body)));
};

export const setPropertyStatus: RequestHandler = async (req, res) => {
  const { status, rejectionReason } = propertyStatusSchema.parse(req.body);
  res.json(await propertyService.setPropertyStatus(req.params.id as string, status, rejectionReason));
};

export const deleteProperty: RequestHandler = async (req, res) => {
  await propertyService.removeProperty(req.params.id as string);
  res.status(204).end();
};

export const addPhoto: RequestHandler = async (req, res) => {
  if (!req.file) {
    throw new AppError(400, 'FILE_REQUIRED', 'Aucun fichier reçu dans le champ « file »');
  }
  const photo = { originalName: req.file.originalname, contentType: req.file.mimetype, content: req.file.buffer };
  res.status(201).json(await propertyService.addPropertyPhoto(req.params.id as string, photo));
};

export const removePhoto: RequestHandler = async (req, res) => {
  res.json(await propertyService.removePropertyPhoto(req.params.id as string, req.params.fileId as string));
};
