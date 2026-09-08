import { Types } from 'mongoose';
import { ServiceOfferingModel } from '../models/ServiceOffering.model';
import type { ServiceOffering } from '../types/catalog';
import type { PricingRule } from '../types/pricing';

type OfferingDoc = Omit<ServiceOffering, 'id' | 'categoryId' | 'providerId'> & {
  _id: Types.ObjectId;
  categoryId: Types.ObjectId;
  providerId: Types.ObjectId;
};

export type ServiceOfferingInput = {
  name: string;
  description?: string;
  categoryId: string;
  providerId: string;
  pricingRule: PricingRule;
  vatRateBps?: number;
  vipOnly?: boolean;
  priorityAccess?: boolean;
  active?: boolean;
};

export type OfferingFilter = {
  active?: boolean;
  vipOnly?: boolean;
  categoryId?: string;
  providerId?: string;
};

function toOffering(doc: OfferingDoc): ServiceOffering {
  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description ?? '',
    categoryId: doc.categoryId.toString(),
    providerId: doc.providerId.toString(),
    pricingRule: {
      unit: doc.pricingRule.unit,
      baseCents: doc.pricingRule.baseCents,
      tiers: doc.pricingRule.tiers.map((tier) => ({ upToQty: tier.upToQty ?? null, unitPriceCents: tier.unitPriceCents })),
      minCents: doc.pricingRule.minCents,
    },
    vatRateBps: doc.vatRateBps,
    vipOnly: doc.vipOnly,
    priorityAccess: doc.priorityAccess,
    active: doc.active,
    createdAt: doc.createdAt,
  };
}

export async function createOffering(input: ServiceOfferingInput): Promise<ServiceOffering> {
  const doc = await ServiceOfferingModel.create(input);
  return toOffering(doc.toObject() as OfferingDoc);
}

export async function findOfferingById(id: string): Promise<ServiceOffering | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  const doc = await ServiceOfferingModel.findById(id).lean<OfferingDoc>();
  return doc ? toOffering(doc) : null;
}

export async function listOfferings(filter: OfferingFilter = {}): Promise<ServiceOffering[]> {
  const query: Record<string, unknown> = {};
  if (filter.active !== undefined) query.active = filter.active;
  if (filter.vipOnly !== undefined) query.vipOnly = filter.vipOnly;
  if (filter.categoryId) query.categoryId = filter.categoryId;
  if (filter.providerId) query.providerId = filter.providerId;
  const docs = await ServiceOfferingModel.find(query).sort({ name: 1 }).lean<OfferingDoc[]>();
  return docs.map(toOffering);
}

export async function countOfferingsByCategory(categoryId: string): Promise<number> {
  return ServiceOfferingModel.countDocuments({ categoryId });
}

export async function updateOffering(id: string, patch: Partial<ServiceOfferingInput>): Promise<ServiceOffering | null> {
  const doc = await ServiceOfferingModel.findByIdAndUpdate(id, { $set: patch }, { returnDocument: 'after', runValidators: true }).lean<OfferingDoc>();
  return doc ? toOffering(doc) : null;
}

export async function deleteOffering(id: string): Promise<boolean> {
  const doc = await ServiceOfferingModel.findByIdAndDelete(id).lean();
  return doc !== null;
}
