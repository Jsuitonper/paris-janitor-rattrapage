import { Types } from 'mongoose';
import { InvoiceModel } from '../models/Invoice.model';
import type { BookingKind } from '../types/payment';
import type { Invoice, InvoiceType, PayoutStatus } from '../types/invoice';

type InvoiceDoc = Omit<Invoice, 'id' | 'travelerId' | 'providerId'> & {
  _id: Types.ObjectId;
  travelerId: Types.ObjectId | null;
  providerId: Types.ObjectId | null;
};

export type InvoiceInput = Omit<Invoice, 'id'> & { id?: string };

export type InvoiceFilter = {
  type?: InvoiceType;
  travelerId?: string;
  providerId?: string;
};

function toInvoice(doc: InvoiceDoc): Invoice {
  return {
    id: doc._id.toString(),
    type: doc.type,
    number: doc.number,
    travelerId: doc.travelerId ? doc.travelerId.toString() : null,
    providerId: doc.providerId ? doc.providerId.toString() : null,
    booking: doc.booking ? { kind: doc.booking.kind, id: doc.booking.id } : null,
    period: doc.period ? { year: doc.period.year, month: doc.period.month } : null,
    party: doc.party,
    lines: doc.lines,
    totals: doc.totals,
    gridFsId: doc.gridFsId,
    payoutStatus: doc.payoutStatus,
    payoutAt: doc.payoutAt ?? null,
    issuedAt: doc.issuedAt,
  };
}

export async function createInvoice(input: InvoiceInput): Promise<Invoice> {
  const { id, ...rest } = input;
  const doc = await InvoiceModel.create(id ? { _id: new Types.ObjectId(id), ...rest } : rest);
  return toInvoice(doc.toObject() as InvoiceDoc);
}

export function newInvoiceId(): string {
  return new Types.ObjectId().toString();
}

export function isDuplicateKey(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 11000;
}

export async function findInvoiceById(id: string): Promise<Invoice | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  const doc = await InvoiceModel.findById(id).lean<InvoiceDoc>();
  return doc ? toInvoice(doc) : null;
}

export async function findInvoiceByBooking(kind: BookingKind, bookingId: string): Promise<Invoice | null> {
  const doc = await InvoiceModel.findOne({ 'booking.kind': kind, 'booking.id': bookingId }).lean<InvoiceDoc>();
  return doc ? toInvoice(doc) : null;
}

export async function findInvoiceByNumber(number: string): Promise<Invoice | null> {
  const doc = await InvoiceModel.findOne({ number }).lean<InvoiceDoc>();
  return doc ? toInvoice(doc) : null;
}

export async function listInvoices(filter: InvoiceFilter = {}): Promise<Invoice[]> {
  const docs = await InvoiceModel.find(filter).sort({ issuedAt: -1 }).lean<InvoiceDoc[]>();
  return docs.map(toInvoice);
}

export async function updatePayoutStatus(id: string, payoutStatus: PayoutStatus, payoutAt: Date | null): Promise<Invoice | null> {
  const doc = await InvoiceModel.findByIdAndUpdate(
    id,
    { $set: { payoutStatus, payoutAt } },
    { returnDocument: 'after' },
  ).lean<InvoiceDoc>();
  return doc ? toInvoice(doc) : null;
}
