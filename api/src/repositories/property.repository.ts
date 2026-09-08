import { Types } from 'mongoose';
import { PropertyModel } from '../models/Property.model';
import type { DateRange, Property, PropertyAddress, PropertyStatus } from '../types/catalog';

type PropertyDoc = Omit<Property, 'id'> & { _id: Types.ObjectId };

export type PropertyInput = {
  title: string;
  description?: string;
  address: PropertyAddress;
  capacity: number;
  bedrooms?: number;
  surfaceM2: number;
  amenities?: string[];
  nightlyRateHtCents: number;
  vatRateBps?: number;
  blockedRanges?: DateRange[];
  status?: PropertyStatus;
};

export type PropertyPatch = Partial<PropertyInput> & { rejectionReason?: string | null; photoIds?: string[] };

export type PropertyFilter = {
  status?: PropertyStatus;
  arrondissement?: number;
  minCapacity?: number;
};

function toProperty(doc: PropertyDoc): Property {
  return {
    id: doc._id.toString(),
    title: doc.title,
    description: doc.description ?? '',
    address: {
      street: doc.address.street,
      postalCode: doc.address.postalCode,
      city: doc.address.city,
      arrondissement: doc.address.arrondissement,
    },
    capacity: doc.capacity,
    bedrooms: doc.bedrooms,
    surfaceM2: doc.surfaceM2,
    amenities: doc.amenities ?? [],
    nightlyRateHtCents: doc.nightlyRateHtCents,
    vatRateBps: doc.vatRateBps,
    photoIds: doc.photoIds ?? [],
    blockedRanges: (doc.blockedRanges ?? []).map((range) => ({ start: range.start, end: range.end })),
    status: doc.status,
    rejectionReason: doc.rejectionReason ?? null,
    createdAt: doc.createdAt,
  };
}

export async function createProperty(input: PropertyInput): Promise<Property> {
  const doc = await PropertyModel.create(input);
  return toProperty(doc.toObject() as PropertyDoc);
}

export async function findPropertyById(id: string): Promise<Property | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  const doc = await PropertyModel.findById(id).lean<PropertyDoc>();
  return doc ? toProperty(doc) : null;
}

export async function listProperties(filter: PropertyFilter = {}): Promise<Property[]> {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.arrondissement) query['address.arrondissement'] = filter.arrondissement;
  if (filter.minCapacity) query.capacity = { $gte: filter.minCapacity };
  const docs = await PropertyModel.find(query).sort({ createdAt: -1 }).lean<PropertyDoc[]>();
  return docs.map(toProperty);
}

export async function updateProperty(id: string, patch: PropertyPatch): Promise<Property | null> {
  const doc = await PropertyModel.findByIdAndUpdate(id, { $set: patch }, { returnDocument: 'after', runValidators: true }).lean<PropertyDoc>();
  return doc ? toProperty(doc) : null;
}

export async function deleteProperty(id: string): Promise<boolean> {
  const doc = await PropertyModel.findByIdAndDelete(id).lean();
  return doc !== null;
}
