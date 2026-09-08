import { Types } from 'mongoose';
import { QuoteLeadModel } from '../models/QuoteLead.model';
import type { LeadContact, LeadStatus, QuoteLead, SimulationBreakdown, SimulationInput } from '../types/lead';

type LeadDoc = Omit<QuoteLead, 'id'> & { _id: Types.ObjectId };

export type LeadInput = {
  input: SimulationInput;
  breakdown: SimulationBreakdown;
};

export type LeadPatch = {
  contact?: LeadContact;
  status?: LeadStatus;
  notes?: string;
};

function toLead(doc: LeadDoc): QuoteLead {
  return {
    id: doc._id.toString(),
    input: doc.input,
    breakdown: doc.breakdown,
    contact: doc.contact ?? null,
    status: doc.status,
    notes: doc.notes ?? '',
    createdAt: doc.createdAt,
  };
}

export async function createLead(input: LeadInput): Promise<QuoteLead> {
  const doc = await QuoteLeadModel.create(input);
  return toLead(doc.toObject() as LeadDoc);
}

export async function findLeadById(id: string): Promise<QuoteLead | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  const doc = await QuoteLeadModel.findById(id).lean<LeadDoc>();
  return doc ? toLead(doc) : null;
}

export async function listLeads(filter: { status?: LeadStatus; withContact?: boolean } = {}): Promise<QuoteLead[]> {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.withContact === true) query.contact = { $ne: null };
  if (filter.withContact === false) query.contact = null;
  const docs = await QuoteLeadModel.find(query).sort({ createdAt: -1 }).lean<LeadDoc[]>();
  return docs.map(toLead);
}

export async function updateLead(id: string, patch: LeadPatch): Promise<QuoteLead | null> {
  const doc = await QuoteLeadModel.findByIdAndUpdate(id, { $set: patch }, { returnDocument: 'after' }).lean<LeadDoc>();
  return doc ? toLead(doc) : null;
}
