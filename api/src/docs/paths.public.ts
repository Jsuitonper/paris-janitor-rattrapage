import { arrayOf, body, objectResponse, pathId, RESPONSES, ref } from './common';
import { queryParameters } from './schemas';
import { catalogPropertyQuerySchema } from '../validators/catalog.schema';
import { publicReviewQuerySchema } from '../validators/engagement.schema';

const AUTH_RESULT = {
  type: 'object',
  properties: { user: { type: 'object' }, token: { type: 'string' } },
};

export const publicPaths: Record<string, unknown> = {
  '/health': {
    get: {
      tags: ['Santé'],
      summary: 'État de l’API et de la connexion MongoDB',
      security: [],
      responses: { 200: { description: 'Service disponible.', content: { 'application/json': { schema: ref('Health') } } } },
    },
  },

  '/auth/register': {
    post: {
      tags: ['Authentification'],
      summary: 'Créer un compte voyageur',
      description:
        'Le rôle est toujours « traveler » : il ne peut pas être choisi par le client. L’e-mail est normalisé en minuscules.',
      security: [],
      requestBody: body('Register'),
      responses: {
        201: { description: 'Compte créé, jeton émis.', content: { 'application/json': { schema: AUTH_RESULT } } },
        400: RESPONSES.validation,
        409: RESPONSES.conflict,
      },
    },
  },

  '/auth/login': {
    post: {
      tags: ['Authentification'],
      summary: 'Ouvrir une session',
      security: [],
      requestBody: body('Login'),
      responses: {
        200: { description: 'Session ouverte.', content: { 'application/json': { schema: AUTH_RESULT } } },
        400: RESPONSES.validation,
        401: RESPONSES.unauthenticated,
        403: RESPONSES.forbidden,
      },
    },
  },

  '/catalog/properties': {
    get: {
      tags: ['Catalogue public'],
      summary: 'Lister les biens publiés',
      security: [],
      parameters: queryParameters(catalogPropertyQuerySchema, {
        arrondissement: 'Arrondissement parisien, de 1 à 20.',
        capacity: 'Capacité minimale recherchée.',
      }),
      responses: { 200: arrayOf('Biens au statut « published » uniquement.') },
    },
  },

  '/catalog/properties/{id}': {
    get: {
      tags: ['Catalogue public'],
      summary: 'Consulter un bien publié',
      security: [],
      parameters: [pathId()],
      responses: { 200: objectResponse('Fiche du bien.'), 404: RESPONSES.notFound },
    },
  },

  '/catalog/properties/{id}/availability': {
    get: {
      tags: ['Catalogue public'],
      summary: 'Périodes indisponibles d’un bien',
      description: 'Réunit les périodes bloquées par l’administration et les séjours demandés ou confirmés.',
      security: [],
      parameters: [pathId()],
      responses: { 200: arrayOf('Intervalles { start, end }.'), 404: RESPONSES.notFound },
    },
  },

  '/catalog/categories': {
    get: {
      tags: ['Catalogue public'],
      summary: 'Lister les catégories de prestations',
      security: [],
      responses: { 200: arrayOf('Catégories.') },
    },
  },

  '/catalog/offerings': {
    get: {
      tags: ['Catalogue public'],
      summary: 'Lister les prestations actives',
      description:
        'Authentification facultative : un jeton change le résultat. Sans jeton, ou pour une formule sans accès prioritaire, les prestations réservées aux Explorator sont masquées.',
      security: [],
      parameters: [
        {
          name: 'categoryId',
          in: 'query',
          required: false,
          schema: { type: 'string', pattern: '^[0-9a-f]{24}$' },
          description: 'Restreindre à une catégorie.',
        },
      ],
      responses: { 200: arrayOf('Prestations visibles par l’appelant.'), 500: RESPONSES.pricingMissing },
    },
  },

  '/catalog/offerings/{id}': {
    get: {
      tags: ['Catalogue public'],
      summary: 'Consulter une prestation',
      description: 'Authentification facultative. Une prestation réservée aux Explorator répond 403 pour les autres.',
      security: [],
      parameters: [pathId()],
      responses: { 200: objectResponse('Fiche de la prestation.'), 403: RESPONSES.forbidden, 404: RESPONSES.notFound },
    },
  },

  '/catalog/offerings/{id}/reviews': {
    get: {
      tags: ['Catalogue public'],
      summary: 'Avis publiés sur une prestation',
      description: 'Seuls les avis approuvés par la modération sont renvoyés.',
      security: [],
      parameters: [pathId(), ...queryParameters(publicReviewQuerySchema)],
      responses: { 200: arrayOf('Avis approuvés.') },
    },
  },

  '/catalog/vip-plans': {
    get: {
      tags: ['Catalogue public'],
      summary: 'Lister les formules VIP',
      security: [],
      responses: { 200: arrayOf('Formules Free, Bag Packer et Explorator.') },
    },
  },

  '/simulator/options': {
    get: {
      tags: ['Simulateur'],
      summary: 'Options de conciergerie proposées par le simulateur',
      description: 'Lues depuis la configuration plateforme, jamais codées en dur.',
      security: [],
      responses: { 200: arrayOf('Options souscriptibles.') },
    },
  },

  '/simulator/simulate': {
    post: {
      tags: ['Simulateur'],
      summary: 'Estimer les gains d’un logement',
      description:
        'Route publique limitée à 20 requêtes par minute et par adresse IP. Chaque simulation est enregistrée comme demande qualifiable en back-office.',
      security: [],
      requestBody: body('SimulationInput'),
      responses: {
        201: objectResponse('Ventilation détaillée et identifiant de la demande créée.'),
        400: RESPONSES.validation,
        429: RESPONSES.rateLimited,
      },
    },
  },

  '/simulator/leads/{id}/contact': {
    post: {
      tags: ['Simulateur'],
      summary: 'Attacher des coordonnées à une simulation',
      security: [],
      parameters: [pathId('id', 'Identifiant renvoyé par la simulation.')],
      requestBody: body('LeadContact'),
      responses: {
        200: objectResponse('Coordonnées enregistrées.'),
        400: RESPONSES.validation,
        404: RESPONSES.notFound,
        409: RESPONSES.conflict,
        429: RESPONSES.rateLimited,
      },
    },
  },

  '/files/{id}': {
    get: {
      tags: ['Fichiers'],
      summary: 'Télécharger un document',
      description:
        'Authentification facultative. Les photos de biens sont publiques ; les factures et pièces jointes exigent d’en être le porteur, ou le rôle administrateur. Répond 304 sur If-None-Match.',
      security: [],
      parameters: [pathId()],
      responses: {
        200: {
          description: 'Flux du fichier, avec ETag et Cache-Control privé.',
          content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
        },
        304: { description: 'Non modifié.' },
        403: RESPONSES.forbidden,
        404: RESPONSES.notFound,
      },
    },
  },

  '/stripe/webhook': {
    post: {
      tags: ['Webhooks Stripe'],
      summary: 'Recevoir un événement Stripe',
      description:
        'Seule source de vérité de l’état d’abonnement et du statut de paiement. Le corps brut est requis pour la vérification de signature. Rejouer un même event.id ne produit aucune seconde mutation.',
      security: [],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object', description: 'Événement Stripe brut.' } } },
      },
      parameters: [
        { name: 'stripe-signature', in: 'header', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: objectResponse('Événement accepté. « duplicate » indique un rejeu ignoré.'),
        400: RESPONSES.validation,
        503: RESPONSES.stripeMissing,
      },
    },
  },
};
