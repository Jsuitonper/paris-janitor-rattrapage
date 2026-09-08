import * as propertyRepository from '../repositories/property.repository';
import * as categoryRepository from '../repositories/serviceCategory.repository';
import * as offeringRepository from '../repositories/serviceOffering.repository';
import * as vipPlanRepository from '../repositories/vipPlan.repository';
import type { Property, ServiceCategory, ServiceOffering } from '../types/catalog';
import type { VipPlan } from '../types/pricing';
import type { AuthUser } from '../types/user';
import { AppError } from '../utils/AppError';
import { unavailableRanges } from './availability.service';
import { listPublicReviews } from './review.service';
import { getUserPlan } from './vip.service';

async function canSeeVipOnly(viewer: AuthUser | undefined): Promise<boolean> {
  if (viewer?.role === 'admin') return true;
  return (await getUserPlan(viewer?.id)).priorityAccess;
}

export function listPublishedProperties(filter: { arrondissement?: number; minCapacity?: number }): Promise<Property[]> {
  return propertyRepository.listProperties({ ...filter, status: 'published' });
}

export async function getPublishedProperty(id: string): Promise<Property> {
  const property = await propertyRepository.findPropertyById(id);
  if (!property || property.status !== 'published') {
    throw new AppError(404, 'PROPERTY_NOT_FOUND', 'Bien introuvable');
  }
  return property;
}

export function listCategories(): Promise<ServiceCategory[]> {
  return categoryRepository.listCategories();
}

export async function listOfferings(viewer: AuthUser | undefined, categoryId?: string): Promise<ServiceOffering[]> {
  const includeVipOnly = await canSeeVipOnly(viewer);
  return offeringRepository.listOfferings({ active: true, categoryId, vipOnly: includeVipOnly ? undefined : false });
}

export async function getOffering(id: string, viewer: AuthUser | undefined): Promise<ServiceOffering> {
  const offering = await offeringRepository.findOfferingById(id);
  if (!offering || !offering.active) {
    throw new AppError(404, 'OFFERING_NOT_FOUND', 'Prestation introuvable');
  }
  if (offering.vipOnly && !(await canSeeVipOnly(viewer))) {
    throw new AppError(403, 'VIP_REQUIRED', 'Cette prestation est réservée aux abonnés Explorator');
  }
  return offering;
}

export function listVipPlans(): Promise<VipPlan[]> {
  return vipPlanRepository.listVipPlans();
}

export async function getPropertyAvailability(id: string): Promise<{ start: Date; end: Date }[]> {
  return unavailableRanges(await getPublishedProperty(id));
}

export async function listOfferingReviews(offeringId: string) {
  return listPublicReviews({ offeringId });
}
