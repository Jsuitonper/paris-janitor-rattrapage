import 'dotenv/config';
import { z } from 'zod';

const optionalString = z.string().trim().transform((value) => (value === '' ? undefined : value)).optional();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean)),
  APP_TRAVELER_URL: z.string().url().default('http://localhost:5173'),
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((value) => (value === 'false' ? false : value === 'true' ? true : Number(value))),
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_PUBLISHABLE_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_PRICE_BAGPACKER_MONTHLY: optionalString,
  STRIPE_PRICE_BAGPACKER_YEARLY: optionalString,
  STRIPE_PRICE_EXPLORATOR_MONTHLY: optionalString,
  STRIPE_PRICE_EXPLORATOR_YEARLY: optionalString,
  STRIPE_RENEWAL_COUPON_ID: optionalString,
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Configuration invalide, démarrage annulé :');
  console.error(z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
