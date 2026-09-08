import { Router } from 'express';
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../../controllers/serviceCategory.controller';

export const adminCategoriesRouter = Router();

adminCategoriesRouter.get('/', listCategories);
adminCategoriesRouter.post('/', createCategory);
adminCategoriesRouter.patch('/:id', updateCategory);
adminCategoriesRouter.delete('/:id', deleteCategory);
