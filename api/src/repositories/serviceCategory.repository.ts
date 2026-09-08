import { Types } from 'mongoose';
import { ServiceCategoryModel } from '../models/ServiceCategory.model';
import type { ServiceCategory } from '../types/catalog';

type CategoryDoc = Omit<ServiceCategory, 'id'> & { _id: Types.ObjectId };

export type ServiceCategoryInput = {
  name: string;
  slug: string;
  description?: string;
};

function toCategory(doc: CategoryDoc): ServiceCategory {
  return { id: doc._id.toString(), name: doc.name, slug: doc.slug, description: doc.description ?? '' };
}

export async function createCategory(input: ServiceCategoryInput): Promise<ServiceCategory> {
  const doc = await ServiceCategoryModel.create(input);
  return toCategory(doc.toObject() as CategoryDoc);
}

export async function findCategoryById(id: string): Promise<ServiceCategory | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  const doc = await ServiceCategoryModel.findById(id).lean<CategoryDoc>();
  return doc ? toCategory(doc) : null;
}

export async function existsCategoryBySlug(slug: string): Promise<boolean> {
  return (await ServiceCategoryModel.exists({ slug })) !== null;
}

export async function listCategories(): Promise<ServiceCategory[]> {
  const docs = await ServiceCategoryModel.find().sort({ name: 1 }).lean<CategoryDoc[]>();
  return docs.map(toCategory);
}

export async function updateCategory(id: string, patch: Partial<ServiceCategoryInput>): Promise<ServiceCategory | null> {
  const doc = await ServiceCategoryModel.findByIdAndUpdate(id, { $set: patch }, { returnDocument: 'after', runValidators: true }).lean<CategoryDoc>();
  return doc ? toCategory(doc) : null;
}

export async function deleteCategory(id: string): Promise<boolean> {
  const doc = await ServiceCategoryModel.findByIdAndDelete(id).lean();
  return doc !== null;
}
