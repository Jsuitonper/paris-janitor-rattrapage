import * as providerRepository from '../repositories/provider.repository';
import type { ProviderInput } from '../repositories/provider.repository';
import type { Provider } from '../types/catalog';
import { AppError } from '../utils/AppError';

export function listProviders(): Promise<Provider[]> {
  return providerRepository.listProviders();
}

export async function getProvider(id: string): Promise<Provider> {
  const provider = await providerRepository.findProviderById(id);
  if (!provider) {
    throw new AppError(404, 'PROVIDER_NOT_FOUND', 'Prestataire introuvable');
  }
  return provider;
}

export function createProvider(input: ProviderInput): Promise<Provider> {
  return providerRepository.createProvider(input);
}

export async function updateProvider(id: string, patch: Partial<ProviderInput>): Promise<Provider> {
  await getProvider(id);
  return (await providerRepository.updateProvider(id, patch))!;
}

export async function removeProvider(id: string): Promise<void> {
  await getProvider(id);
  await providerRepository.deleteProvider(id);
}
