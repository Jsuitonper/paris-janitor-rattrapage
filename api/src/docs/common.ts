type JsonSchema = Record<string, unknown>;

export const ERROR_REF = { $ref: '#/components/schemas/Error' };

function errorResponse(description: string): JsonSchema {
  return { description, content: { 'application/json': { schema: ERROR_REF } } };
}

export const RESPONSES = {
  validation: errorResponse('VALIDATION_ERROR — corps ou paramètres refusés par le validateur.'),
  unauthenticated: errorResponse('UNAUTHENTICATED — jeton absent, expiré, falsifié, ou compte disparu.'),
  forbidden: errorResponse('FORBIDDEN — rôle insuffisant ou ressource appartenant à un autre utilisateur.'),
  notFound: errorResponse('Ressource introuvable. Le code précise laquelle.'),
  conflict: errorResponse('Conflit métier. Le code précise la règle enfreinte.'),
  rateLimited: errorResponse('RATE_LIMITED — trop de requêtes depuis cette adresse.'),
  stripeMissing: errorResponse('STRIPE_NOT_CONFIGURED — aucune clé Stripe sur ce serveur.'),
  pricingMissing: errorResponse('PRICING_NOT_CONFIGURED ou VIP_PLAN_MISSING — lancer le seed de tarification.'),
} as const;

export function json(schemaRef: JsonSchema, description: string): JsonSchema {
  return { description, content: { 'application/json': { schema: schemaRef } } };
}

export function ref(name: string): JsonSchema {
  return { $ref: '#/components/schemas/' + name };
}

export function arrayOf(description: string): JsonSchema {
  return {
    description,
    content: { 'application/json': { schema: { type: 'array', items: { type: 'object' } } } },
  };
}

export function objectResponse(description: string): JsonSchema {
  return { description, content: { 'application/json': { schema: { type: 'object' } } } };
}

export function body(name: string, required = true): JsonSchema {
  return { required, content: { 'application/json': { schema: ref(name) } } };
}

export function pathId(name = 'id', description = 'Identifiant MongoDB sur 24 caractères hexadécimaux.'): JsonSchema {
  return {
    name,
    in: 'path',
    required: true,
    description,
    schema: { type: 'string', pattern: '^[0-9a-f]{24}$' },
  };
}

export const BEARER = [{ bearerAuth: [] }];
