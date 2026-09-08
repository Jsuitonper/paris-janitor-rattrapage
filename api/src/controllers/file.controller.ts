import type { RequestHandler } from 'express';
import * as fileService from '../services/file.service';
import { fileUploadSchema } from '../validators/file.schema';
import { AppError } from '../utils/AppError';

export const upload: RequestHandler = async (req, res) => {
  if (!req.file) {
    throw new AppError(400, 'FILE_REQUIRED', 'Aucun fichier reçu dans le champ « file »');
  }
  const body = fileUploadSchema.parse(req.body);
  const stored = await fileService.storeFile({
    kind: body.kind,
    originalName: req.file.originalname,
    contentType: req.file.mimetype,
    content: req.file.buffer,
    ownerUserId: body.ownerUserId ?? null,
    propertyId: body.propertyId ?? null,
    bookingId: body.bookingId ?? null,
  });
  res.status(201).json(stored);
};

export const download: RequestHandler = async (req, res) => {
  const id = req.params.id as string;
  const etag = '"' + id + '"';
  if (req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return;
  }
  const { file, content } = await fileService.readFile(id, req.user);
  res.setHeader('Content-Type', file.metadata.contentType);
  res.setHeader('Content-Length', content.length);
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.setHeader('Content-Disposition', 'inline; filename="' + encodeURIComponent(file.metadata.originalName) + '"');
  res.send(content);
};

export const remove: RequestHandler = async (req, res) => {
  await fileService.removeFile(req.params.id as string);
  res.status(204).end();
};
