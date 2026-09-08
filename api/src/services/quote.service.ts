import * as propertyRepository from '../repositories/property.repository';
import * as stayBookingRepository from '../repositories/stayBooking.repository';
import * as userRepository from '../repositories/user.repository';
import * as vipQuotaUsageRepository from '../repositories/vipQuotaUsage.repository';
import type { Property, ServiceOffering } from '../types/catalog';
import type { PricingSnapshot, VipContext, VipPlan } from '../types/pricing';
import type { AuthUser } from '../types/user';
import { AppError } from '../utils/AppError';
import { isPropertyAvailable, nightsBetween, parseDay } from './availability.service';
import { getOffering } from './catalog.service';
import { quoteService, quoteStay } from './pricing/quote';
import { getCommissionTiers, getSettings } from './pricingConfig.service';
import { effectiveVipTier, getPlanForTier } from './vip.service';

export type StayRequest = { propertyId: string; startDate: string; endDate: string; guests: number };

export type ServiceRequest = { offeringId: string; qty: number; scheduledAt: Date; stayBookingId?: string; notes?: string };

export type PreparedStay = { property: Property; startDate: Date; endDate: Date; nights: number; pricing: PricingSnapshot };

export type PreparedService = { offering: ServiceOffering; plan: VipPlan; pricing: PricingSnapshot };

export async function vipContextFor(userId: string): Promise<VipContext> {
  const user = await userRepository.findUserById(userId);
  const plan = await getPlanForTier(effectiveVipTier(user));
  const usedWindowIndexes = plan.freeQuota
    ? await vipQuotaUsageRepository.listUsedWindowIndexes(userId, plan.freeQuota.windowMonths)
    : [];
  return { plan, anchorAt: user?.vip.anchorAt ?? null, usedWindowIndexes };
}

export async function prepareStay(request: StayRequest): Promise<PreparedStay> {
  const property = await propertyRepository.findPropertyById(request.propertyId);
  if (!property || property.status !== 'published') {
    throw new AppError(404, 'PROPERTY_NOT_FOUND', 'Bien introuvable');
  }
  const startDate = parseDay(request.startDate);
  const endDate = parseDay(request.endDate);
  const nights = nightsBetween(startDate, endDate);
  if (nights < 1) {
    throw new AppError(400, 'INVALID_DATES', 'Le séjour doit compter au moins une nuit');
  }
  if (request.guests > property.capacity) {
    throw new AppError(400, 'CAPACITY_EXCEEDED', 'Ce bien accueille au plus ' + property.capacity + ' voyageurs');
  }
  if (!(await isPropertyAvailable(property, startDate, endDate))) {
    throw new AppError(409, 'DATES_UNAVAILABLE', 'Ces dates ne sont pas disponibles');
  }
  const settings = await getSettings();
  const pricing = quoteStay({
    nights,
    nightlyRateHtCents: property.nightlyRateHtCents,
    vatRateBps: property.vatRateBps,
    stayCommissionBps: settings.stayCommissionBps,
  });
  return { property, startDate, endDate, nights, pricing };
}

export async function prepareService(viewer: AuthUser, request: ServiceRequest, at = new Date()): Promise<PreparedService> {
  const offering = await getOffering(request.offeringId, viewer);
  if (request.stayBookingId) {
    const stay = await stayBookingRepository.findStayBookingById(request.stayBookingId);
    if (!stay || stay.travelerId !== viewer.id) {
      throw new AppError(404, 'STAY_NOT_FOUND', 'Séjour introuvable');
    }
  }
  const vip = await vipContextFor(viewer.id);
  const pricing = quoteService({
    pricingRule: offering.pricingRule,
    qty: request.qty,
    vatRateBps: offering.vatRateBps,
    commissionTiers: await getCommissionTiers(),
    vip,
    at,
  });
  return { offering, plan: vip.plan, pricing };
}

export async function previewStay(request: StayRequest): Promise<PricingSnapshot> {
  return (await prepareStay(request)).pricing;
}

export async function previewService(viewer: AuthUser, request: ServiceRequest): Promise<PricingSnapshot> {
  return (await prepareService(viewer, request)).pricing;
}
