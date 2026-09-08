import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    env: {
      JWT_SECRET: 'vitest-secret-0123456789abcdef',
      MONGODB_URI: 'mongodb://127.0.0.1:1/unused',
      CORS_ORIGINS: 'http://localhost:5173',
      STRIPE_SECRET_KEY: '',
      STRIPE_PUBLISHABLE_KEY: '',
      STRIPE_WEBHOOK_SECRET: 'whsec_vitest_secret',
      STRIPE_PRICE_BAGPACKER_MONTHLY: 'price_bagpacker_monthly',
      STRIPE_PRICE_BAGPACKER_YEARLY: 'price_bagpacker_yearly',
      STRIPE_PRICE_EXPLORATOR_MONTHLY: 'price_explorator_monthly',
      STRIPE_PRICE_EXPLORATOR_YEARLY: 'price_explorator_yearly',
      STRIPE_RENEWAL_COUPON_ID: 'coupon_renewal_10',
    },
    hookTimeout: 180000,
    testTimeout: 30000,
    coverage: {
      include: ['src/services/pricing/**', 'src/utils/money.ts'],
      reporter: ['text'],
    },
  },
});
