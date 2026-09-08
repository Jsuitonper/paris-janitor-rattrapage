import type { RequestHandler } from 'express';
import * as categoryService from '../services/serviceCategory.service';
import { categoryPatchSchema, categorySchema } from '../validators/catalog.schema';

export const listCategories: RequestHandler = async (_req, res) => {
  res.json(await categoryService.listCategories());
};

export const createCategory: RequestHandler = async (req, res) => {
  res.status(201).json(await categoryService.createCategory(categorySchema.parse(req.body)));
};

export const updateCategory: RequestHandler = async (req, res) => {
  res.json(await categoryService.updateCategory(req.params.id as string, categoryPatchSchema.parse(req.body)));
};

export const deleteCategory: RequestHandler = async (req, res) => {
  await categoryService.removeCategory(req.params.id as string);
  res.status(204).end();
};
