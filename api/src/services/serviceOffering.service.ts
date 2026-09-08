import * as providerRepository from '../repositories/provider.repository';
import * as categoryRepository from '../repositories/serviceCategory.repository';
import * as offeringRepository from '../repositories/serviceOffering.repository';
import type { ServiceOfferingInput } from '../repositories/serviceOffering.repository';
import type { ServiceOffering } from '../types/catalog';
import { AppError } from '../utils/AppError';

async function assertReferences(input: Partial<ServiceOfferingInput>): Promise<void> {
  if (input.categoryId && !(await categoryRepository.findCategoryById(input.categoryId))) {
    throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Catégorie introuvable');
  }
  if (input.providerId && !(await providerRepository.findProviderById(input.providerId))) {
    throw new AppError(404, 'PROVIDER_NOT_FOUND', 'Prestataire introuvable');
  }
}

export function listOfferings(): Promise<ServiceOffering[]> {
  return offeringRepository.listOfferings();
}

export async function getOffering(id: string): Promise<ServiceOffering> {
  const offering = await offeringRepository.findOfferingById(id);
  if (!offering) {
    throw new AppError(404, 'OFFERING_NOT_FOUND', 'Prestation introuvable');
  }
  return offering;
}

export async function createOffering(input: ServiceOfferingInput): Promise<ServiceOffering> {
  await assertReferences(input);
  return offeringRepository.createOffering(input);
}

export async function updateOffering(id: string, patch: Partial<ServiceOfferingInput>): Promise<ServiceOffering> {
  await getOffering(id);
  await assertReferences(patch);
  return (await offeringRepository.updateOffering(id, patch))!;
}

export async function removeOffering(id: string): Promise<void> {
  await getOffering(id);
  await offeringRepository.deleteOffering(id);
}
