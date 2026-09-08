import { Schema, model } from 'mongoose';

const invoiceLineSchema = new Schema(
  {
    label: { type: String, required: true },
    qty: { type: Number, required: true },
    unitLabel: { type: String, required: true },
    bookingKind: { type: String, enum: ['stay', 'service'], required: true },
    bookingId: { type: String, required: true },
    performedAt: { type: Date, required: true },
    grossHtCents: { type: Number, required: true },
    discountHtCents: { type: Number, required: true },
    netHtCents: { type: Number, required: true },
    commissionBps: { type: Number, required: true },
    commissionHtCents: { type: Number, required: true },
    providerNetHtCents: { type: Number, required: true },
    vatRateBps: { type: Number, required: true },
    vatCents: { type: Number, required: true },
    totalTtcCents: { type: Number, required: true },
  },
  { _id: false },
);

const invoiceTotalsSchema = new Schema(
  {
    grossHtCents: { type: Number, required: true },
    discountHtCents: { type: Number, required: true },
    netHtCents: { type: Number, required: true },
    commissionHtCents: { type: Number, required: true },
    providerNetHtCents: { type: Number, required: true },
    vatCents: { type: Number, required: true },
    totalTtcCents: { type: Number, required: true },
  },
  { _id: false },
);

const invoiceSchema = new Schema(
  {
    type: { type: String, enum: ['traveler', 'provider'], required: true },
    number: { type: String, required: true, unique: true },
    travelerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider', default: null },
    booking: {
      type: new Schema({ kind: { type: String, enum: ['stay', 'service'] }, id: String }, { _id: false }),
      default: null,
    },
    period: {
      type: new Schema({ year: Number, month: Number }, { _id: false }),
      default: null,
    },
    party: {
      name: { type: String, required: true },
      email: { type: String, default: '' },
      detail: { type: String, default: '' },
    },
    lines: { type: [invoiceLineSchema], required: true },
    totals: { type: invoiceTotalsSchema, required: true },
    gridFsId: { type: String, required: true },
    payoutStatus: { type: String, enum: ['not_applicable', 'pending', 'sent'], default: 'not_applicable' },
    payoutAt: { type: Date, default: null },
    issuedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

invoiceSchema.index({ 'booking.kind': 1, 'booking.id': 1 }, { unique: true, sparse: true });
invoiceSchema.index({ travelerId: 1, issuedAt: -1 });
invoiceSchema.index({ providerId: 1, issuedAt: -1 });

export const InvoiceModel = model('Invoice', invoiceSchema);
