import { z } from 'zod';
import * as auth from '../validators/auth.schema';
import * as booking from '../validators/booking.schema';
import * as catalog from '../validators/catalog.schema';
import * as engagement from '../validators/engagement.schema';
import * as file from '../validators/file.schema';
import * as payment from '../validators/payment.schema';
import * as pricing from '../validators/pricing.schema';
import * as simulator from '../validators/simulator.schema';
import * as subscription from '../validators/subscription.schema';

type JsonSchema = Record<string, unknown>;

/*
 * Les corps et paramètres documentés sont dérivés des validateurs Zod, jamais
 * réécrits : ce que refuse l'API est exactement ce que décrit la documentation.
 *
 * Zod ne sait pas représenter z.coerce.date() en JSON Schema — il renvoie un
 * schéma vide. On le rattrape ici pour produire une chaîne date-time.
 */
function toJsonSchema(schema: z.ZodType): JsonSchema {
  return z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io: 'input',
    unrepresentable: 'any',
    override: (context) => {
      if (context.zodSchema._zod.def.type === 'date') {
        context.jsonSchema.type = 'string';
        context.jsonSchema.format = 'date-time';
      }
    },
  }) as JsonSchema;
}

const VALIDATORS: Record<string, z.ZodType> = {
  Register: auth.registerSchema,
  Login: auth.loginSchema,

  PricingRule: pricing.pricingRuleSchema,
  CommissionTiers: pricing.commissionTiersSchema,
  VipPlanPatch: pricing.vipPlanPatchSchema,
  SimulatorOption: pricing.simulatorOptionSchema,
  PlatformSettingsPatch: pricing.settingsPatchSchema,
  PricePreview: pricing.pricePreviewSchema,

  Provider: catalog.providerSchema,
  ProviderPatch: catalog.providerPatchSchema,
  ServiceCategory: catalog.categorySchema,
  ServiceCategoryPatch: catalog.categoryPatchSchema,
  ServiceOffering: catalog.offeringSchema,
  ServiceOfferingPatch: catalog.offeringPatchSchema,
  Property: catalog.propertySchema,
  PropertyPatch: catalog.propertyPatchSchema,
  PropertyStatus: catalog.propertyStatusSchema,

  StayBookingRequest: booking.stayQuoteSchema,
  ServiceBookingRequest: booking.serviceQuoteSchema,
  QuotePreviewRequest: booking.quotePreviewSchema,
  BookingStatus: booking.bookingStatusSchema,

  CheckoutRequest: subscription.checkoutSchema,
  PaymentIntentRequest: payment.paymentIntentSchema,

  FileUpload: file.fileUploadSchema,
  ProviderPayoutPeriod: file.providerPayoutSchema,
  PayoutStatus: file.payoutStatusSchema,

  InterventionReport: engagement.interventionReportSchema,
  ReviewSubmission: engagement.reviewSchema,
  ReviewModeration: engagement.moderationSchema,
  Message: engagement.messageSchema,

  SimulationInput: simulator.simulationInputSchema,
  LeadContact: simulator.leadContactSchema,
  LeadQualification: simulator.leadQualifySchema,
};

/* Schémas rédigés à la main : ils décrivent des réponses, que l'API ne valide
 * pas avec Zod. Il n'existe donc aucune source à dériver. */
const RESPONSE_SCHEMAS: Record<string, JsonSchema> = {
  Error: {
    type: 'object',
    required: ['error'],
    properties: {
      error: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: { type: 'string', example: 'FORBIDDEN' },
          message: { type: 'string', example: 'Cette réservation ne vous appartient pas' },
          details: {
            type: 'object',
            additionalProperties: { type: 'array', items: { type: 'string' } },
            description: 'Présent uniquement sur VALIDATION_ERROR : champs fautifs et motifs.',
          },
        },
      },
    },
  },
  Health: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ok'] },
      db: { type: 'string', enum: ['connected', 'disconnected'] },
    },
  },
};

export function buildComponentSchemas(): Record<string, JsonSchema> {
  const derived = Object.fromEntries(
    Object.entries(VALIDATORS).map(([name, schema]) => [name, toJsonSchema(schema)]),
  );
  return { ...derived, ...RESPONSE_SCHEMAS };
}

export function queryParameters(schema: z.ZodType, description?: Record<string, string>): JsonSchema[] {
  const json = toJsonSchema(schema);
  const properties = (json.properties ?? {}) as Record<string, JsonSchema>;
  const required = (json.required ?? []) as string[];
  return Object.entries(properties).map(([name, propertySchema]) => ({
    name,
    in: 'query',
    required: required.includes(name),
    schema: propertySchema,
    ...(description?.[name] ? { description: description[name] } : {}),
  }));
}

export const OBJECT_ID_SCHEMA = toJsonSchema(catalog.objectIdSchema);
