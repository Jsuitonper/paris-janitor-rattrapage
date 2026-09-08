import type { Express } from 'express';
import request from 'supertest';
import { webhookVerifier } from '../../src/config/stripe';

export const WEBHOOK_SECRET = 'whsec_vitest_secret';

export function signedWebhook(app: Express, event: object, secret = WEBHOOK_SECRET) {
  const payload = JSON.stringify(event);
  const header = webhookVerifier.webhooks.generateTestHeaderString({ payload, secret });
  return request(app).post('/api/stripe/webhook').set('stripe-signature', header).set('Content-Type', 'application/json').send(payload);
}

export function stripeEvent(id: string, type: string, object: object) {
  return { id, object: 'event', type, api_version: '2026-01-01', created: 1, livemode: false, pending_webhooks: 0, request: null, data: { object } };
}

export function subscriptionObject(priceId: string, status = 'active', extra: object = {}) {
  return {
    id: 'sub_lea',
    object: 'subscription',
    customer: 'cus_lea',
    status,
    cancel_at_period_end: false,
    metadata: {},
    items: { object: 'list', data: [{ id: 'si_1', object: 'subscription_item', price: { id: priceId, object: 'price' }, current_period_end: 1800000000 }] },
    ...extra,
  };
}

export function invoiceObject(id: string, billingReason?: string) {
  return { id, object: 'invoice', customer: 'cus_lea', billing_reason: billingReason };
}
