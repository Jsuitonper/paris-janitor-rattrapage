import * as categoryRepository from '../repositories/serviceCategory.repository';
import type { ServiceCategoryInput } from '../repositories/serviceCategory.repository';
import * as offeringRepository from '../repositories/serviceOffering.repository';
import type { ServiceCategory } from '../types/catalog';
import { AppError } from '../utils/AppError';

export function listCategories(): Promise<ServiceCategory[]> {
  return categoryRepository.listCategories();
}

export async function getCategory(id: string): Promise<ServiceCategory> {
  const category = await categoryRepository.findCategoryById(id);
  if (!category) {
    throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Catégorie introuvable');
  }
  return category;
}

export async function createCategory(input: ServiceCategoryInput): Promise<ServiceCategory> {
  if (await categoryRepository.existsCategoryBySlug(input.slug)) {
    throw new AppError(409, 'SLUG_TAKEN', 'Ce slug est déjà utilisé');
  }
  return categoryRepository.createCategory(input);
}

export async function updateCategory(id: string, patch: Partial<ServiceCategoryInput>): Promise<ServiceCategory> {
  const current = await getCategory(id);
  if (patch.slug && patch.slug !== current.slug && (await categoryRepository.existsCategoryBySlug(patch.slug))) {
    throw new AppError(409, 'SLUG_TAKEN', 'Ce slug est déjà utilisé');
  }
  return (await categoryRepository.updateCategory(id, patch))!;
}

export async function removeCategory(id: string): Promise<void> {
  await getCategory(id);
  if ((await offeringRepository.countOfferingsByCategory(id)) > 0) {
    throw new AppError(409, 'CATEGORY_IN_USE', 'Des prestations utilisent encore cette catégorie');
  }
  await categoryRepository.deleteCategory(id);
}
