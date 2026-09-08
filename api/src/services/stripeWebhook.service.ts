import type Stripe from 'stripe';
import * as stripeEventRepository from '../repositories/stripeEvent.repository';
import * as paymentService from './payment.service';
import * as subscriptionService from './subscription.service';

export type WebhookResult = { duplicate: boolean; handled: boolean };

async function dispatch(event: Stripe.Event): Promise<boolean> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.mode === 'subscription' && session.client_reference_id && typeof session.customer === 'string') {
        await subscriptionService.linkCustomer(session.client_reference_id, session.customer);
      }
      return true;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const user = await subscriptionService.findUserForCustomer(subscription.customer, subscription.metadata?.userId);
      if (user) await subscriptionService.applySubscription(user, subscription);
      return true;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const user = await subscriptionService.findUserForCustomer(subscription.customer, subscription.metadata?.userId);
      if (user) await subscriptionService.applySubscriptionDeleted(user);
      return true;
    }
    case 'invoice.paid': {
      const invoice = event.data.object;
      const user = await subscriptionService.findUserForCustomer(invoice.customer);
      if (user) await subscriptionService.applyInvoicePaid(user, invoice);
      return true;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const user = await subscriptionService.findUserForCustomer(invoice.customer);
      if (user) await subscriptionService.applyInvoicePaymentFailed(user);
      return true;
    }
    case 'payment_intent.succeeded':
      await paymentService.applyPaymentIntentSucceeded(event.data.object);
      return true;
    case 'payment_intent.payment_failed':
    case 'payment_intent.canceled':
      await paymentService.applyPaymentIntentFailed(event.data.object);
      return true;
    default:
      return false;
  }
}

export async function processStripeEvent(event: Stripe.Event): Promise<WebhookResult> {
  const claimed = await stripeEventRepository.claimStripeEvent(event.id, event.type);
  if (!claimed) {
    return { duplicate: true, handled: false };
  }
  try {
    return { duplicate: false, handled: await dispatch(event) };
  } catch (error) {
    await stripeEventRepository.releaseStripeEvent(event.id);
    throw error;
  }
}
