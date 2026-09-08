import { Types } from 'mongoose';
import { ProviderModel } from '../models/Provider.model';
import type { Provider, ProviderStatus } from '../types/catalog';

type ProviderDoc = Omit<Provider, 'id'> & { _id: Types.ObjectId };

export type ProviderInput = {
  name: string;
  job: string;
  email: string;
  phone?: string | null;
  status?: ProviderStatus;
};

function toProvider(doc: ProviderDoc): Provider {
  return {
    id: doc._id.toString(),
    name: doc.name,
    job: doc.job,
    email: doc.email,
    phone: doc.phone ?? null,
    status: doc.status,
    ratingCount: doc.ratingCount,
    ratingSum: doc.ratingSum,
    createdAt: doc.createdAt,
  };
}

export async function createProvider(input: ProviderInput): Promise<Provider> {
  const doc = await ProviderModel.create(input);
  return toProvider(doc.toObject() as ProviderDoc);
}

export async function findProviderById(id: string): Promise<Provider | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  const doc = await ProviderModel.findById(id).lean<ProviderDoc>();
  return doc ? toProvider(doc) : null;
}

export async function listProviders(): Promise<Provider[]> {
  const docs = await ProviderModel.find().sort({ createdAt: -1 }).lean<ProviderDoc[]>();
  return docs.map(toProvider);
}

export async function updateProvider(id: string, patch: Partial<ProviderInput>): Promise<Provider | null> {
  const doc = await ProviderModel.findByIdAndUpdate(id, { $set: patch }, { returnDocument: 'after', runValidators: true }).lean<ProviderDoc>();
  return doc ? toProvider(doc) : null;
}

export async function deleteProvider(id: string): Promise<boolean> {
  const doc = await ProviderModel.findByIdAndDelete(id).lean();
  return doc !== null;
}

export async function updateProviderRating(id: string, ratingCount: number, ratingSum: number): Promise<void> {
  await ProviderModel.findByIdAndUpdate(id, { $set: { ratingCount, ratingSum } });
}
