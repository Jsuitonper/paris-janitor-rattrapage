import { arrayOf, BEARER, body, objectResponse, pathId, RESPONSES } from './common';

const URL_RESPONSE = {
  description: 'URL Stripe vers laquelle rediriger le navigateur.',
  content: { 'application/json': { schema: { type: 'object', properties: { url: { type: 'string' } } } } },
};

const bookingIdParam = pathId('id', 'Identifiant de la réservation de prestation.');

export const travelerPaths: Record<string, unknown> = {
  '/me': {
    get: {
      tags: ['Compte'],
      summary: 'Profil de l’utilisateur connecté',
      description: 'L’empreinte du mot de passe n’est jamais renvoyée.',
      security: BEARER,
      responses: { 200: objectResponse('Profil, rôle et état VIP.'), 401: RESPONSES.unauthenticated },
    },
  },

  '/quotes/preview': {
    post: {
      tags: ['Devis'],
      summary: 'Estimer un séjour ou une prestation',
      description:
        'Ne persiste rien et ne consomme aucun quota VIP. Partage exactement le code de calcul utilisé à la création d’une réservation, donc le montant affiché est celui qui sera enregistré.',
      security: BEARER,
      requestBody: body('QuotePreviewRequest'),
      responses: {
        200: objectResponse('Instantané tarifaire complet.'),
        400: RESPONSES.validation,
        401: RESPONSES.unauthenticated,
        403: RESPONSES.forbidden,
        404: RESPONSES.notFound,
        409: RESPONSES.conflict,
      },
    },
  },

  '/bookings': {
    get: {
      tags: ['Réservations'],
      summary: 'Mes séjours et mes prestations',
      security: BEARER,
      responses: { 200: objectResponse('Objet { stays, services }.'), 401: RESPONSES.unauthenticated },
    },
  },

  '/bookings/stays': {
    post: {
      tags: ['Réservations'],
      summary: 'Réserver un séjour',
      description:
        'L’instantané tarifaire est figé à la création : modifier ensuite un tarif ou un barème ne change aucun montant.',
      security: BEARER,
      requestBody: body('StayBookingRequest'),
      responses: {
        201: objectResponse('Séjour créé, instantané tarifaire inclus.'),
        400: RESPONSES.validation,
        401: RESPONSES.unauthenticated,
        404: RESPONSES.notFound,
        409: RESPONSES.conflict,
      },
    },
  },

  '/bookings/stays/{id}': {
    get: {
      tags: ['Réservations'],
      summary: 'Consulter un séjour',
      security: BEARER,
      parameters: [pathId('id', 'Identifiant du séjour.')],
      responses: {
        200: objectResponse('Séjour.'),
        401: RESPONSES.unauthenticated,
        403: RESPONSES.forbidden,
        404: RESPONSES.notFound,
      },
    },
  },

  '/bookings/stays/{id}/cancel': {
    post: {
      tags: ['Réservations'],
      summary: 'Annuler un séjour',
      security: BEARER,
      parameters: [pathId('id', 'Identifiant du séjour.')],
      responses: {
        200: objectResponse('Séjour annulé.'),
        401: RESPONSES.unauthenticated,
        403: RESPONSES.forbidden,
        404: RESPONSES.notFound,
        409: RESPONSES.conflict,
      },
    },
  },

  '/bookings/services': {
    post: {
      tags: ['Réservations'],
      summary: 'Réserver une prestation',
      description:
        'Si la formule VIP ouvre droit à une prestation offerte et que la prestation est éligible, le total est nul, le quota est consommé et la réservation est marquée payée sans passer par Stripe.',
      security: BEARER,
      requestBody: body('ServiceBookingRequest'),
      responses: {
        201: objectResponse('Prestation créée, instantané tarifaire inclus.'),
        400: RESPONSES.validation,
        401: RESPONSES.unauthenticated,
        403: RESPONSES.forbidden,
        404: RESPONSES.notFound,
        409: RESPONSES.conflict,
      },
    },
  },

  '/bookings/services/{id}': {
    get: {
      tags: ['Réservations'],
      summary: 'Consulter une prestation',
      security: BEARER,
      parameters: [bookingIdParam],
      responses: {
        200: objectResponse('Prestation.'),
        401: RESPONSES.unauthenticated,
        403: RESPONSES.forbidden,
        404: RESPONSES.notFound,
      },
    },
  },

  '/bookings/services/{id}/cancel': {
    post: {
      tags: ['Réservations'],
      summary: 'Annuler une prestation',
      description: 'Libère le quota VIP éventuellement consommé et retire la fiche d’intervention pré-remplie.',
      security: BEARER,
      parameters: [bookingIdParam],
      responses: {
        200: objectResponse('Prestation annulée.'),
        401: RESPONSES.unauthenticated,
        403: RESPONSES.forbidden,
        404: RESPONSES.notFound,
        409: RESPONSES.conflict,
      },
    },
  },

  '/payments/config': {
    get: {
      tags: ['Paiements'],
      summary: 'Clé publiable Stripe',
      security: BEARER,
      responses: {
        200: objectResponse('Clé publiable à passer à Stripe.js.'),
        401: RESPONSES.unauthenticated,
        503: RESPONSES.stripeMissing,
      },
    },
  },

  '/payments/intent': {
    post: {
      tags: ['Paiements'],
      summary: 'Préparer le paiement d’une réservation',
      description:
        'Le montant est repris de l’instantané tarifaire, jamais recalculé. Une clé d’idempotence par réservation garantit qu’un double appel renvoie le même PaymentIntent. Le passage en « payée » ne se fait que par webhook.',
      security: BEARER,
      requestBody: body('PaymentIntentRequest'),
      responses: {
        200: objectResponse('Secret client, identifiant et montant.'),
        400: RESPONSES.validation,
        401: RESPONSES.unauthenticated,
        403: RESPONSES.forbidden,
        404: RESPONSES.notFound,
        409: RESPONSES.conflict,
        503: RESPONSES.stripeMissing,
      },
    },
  },

  '/payments': {
    get: {
      tags: ['Paiements'],
      summary: 'Mes règlements',
      security: BEARER,
      responses: { 200: arrayOf('Règlements de l’utilisateur.'), 401: RESPONSES.unauthenticated },
    },
  },

  '/invoices': {
    get: {
      tags: ['Factures'],
      summary: 'Mes factures',
      security: BEARER,
      responses: { 200: arrayOf('Factures voyageur.'), 401: RESPONSES.unauthenticated },
    },
  },

  '/invoices/{id}': {
    get: {
      tags: ['Factures'],
      summary: 'Consulter une facture',
      description: 'Le PDF archivé se télécharge séparément par GET /files/{gridFsId}.',
      security: BEARER,
      parameters: [pathId('id', 'Identifiant de la facture.')],
      responses: {
        200: objectResponse('Facture, lignes et totaux figés à l’émission.'),
        401: RESPONSES.unauthenticated,
        403: RESPONSES.forbidden,
        404: RESPONSES.notFound,
      },
    },
  },

  '/subscription/me': {
    get: {
      tags: ['Abonnement'],
      summary: 'Mon abonnement et mon quota',
      description:
        'La fenêtre de quota est ancrée sur la date de première souscription, pas sur le cycle de facturation Stripe.',
      security: BEARER,
      responses: { 200: objectResponse('État VIP, formule et fenêtre de quota.'), 401: RESPONSES.unauthenticated },
    },
  },

  '/subscription/checkout': {
    post: {
      tags: ['Abonnement'],
      summary: 'Ouvrir un paiement d’abonnement',
      description: 'L’activation de la formule n’a lieu qu’à réception du webhook, jamais au retour du navigateur.',
      security: BEARER,
      requestBody: body('CheckoutRequest'),
      responses: {
        200: URL_RESPONSE,
        400: RESPONSES.validation,
        401: RESPONSES.unauthenticated,
        409: RESPONSES.conflict,
        502: { description: 'STRIPE_ERROR — Stripe n’a pas renvoyé d’URL.' },
        503: RESPONSES.stripeMissing,
      },
    },
  },

  '/subscription/portal': {
    post: {
      tags: ['Abonnement'],
      summary: 'Ouvrir le portail client Stripe',
      description: 'Changement de formule et résiliation sont délégués au portail.',
      security: BEARER,
      responses: {
        200: URL_RESPONSE,
        401: RESPONSES.unauthenticated,
        409: RESPONSES.conflict,
        503: RESPONSES.stripeMissing,
      },
    },
  },

  '/reviews': {
    get: {
      tags: ['Avis'],
      summary: 'Mes avis et leur statut de modération',
      security: BEARER,
      responses: { 200: arrayOf('Avis déposés par l’utilisateur.'), 401: RESPONSES.unauthenticated },
    },
    post: {
      tags: ['Avis'],
      summary: 'Évaluer une prestation réalisée',
      description:
        'Ouvert aux trois formules, Free comprise. La prestation doit être terminée et appartenir à l’auteur, et ne peut être évaluée qu’une fois.',
      security: BEARER,
      requestBody: body('ReviewSubmission'),
      responses: {
        201: objectResponse('Avis enregistré, en attente de modération.'),
        400: RESPONSES.validation,
        401: RESPONSES.unauthenticated,
        403: RESPONSES.forbidden,
        404: RESPONSES.notFound,
        409: RESPONSES.conflict,
      },
    },
  },

  '/threads': {
    get: {
      tags: ['Messagerie'],
      summary: 'Mes fils de discussion',
      security: BEARER,
      responses: { 200: arrayOf('Fils rattachés aux prestations de l’utilisateur.'), 401: RESPONSES.unauthenticated },
    },
  },

  '/threads/{id}': {
    get: {
      tags: ['Messagerie'],
      summary: 'Lire le fil d’une prestation',
      description: 'Le paramètre est l’identifiant de la réservation, pas celui du fil. La lecture remet les non-lus à zéro.',
      security: BEARER,
      parameters: [bookingIdParam],
      responses: {
        200: objectResponse('Objet { thread, messages } trié chronologiquement.'),
        401: RESPONSES.unauthenticated,
        403: RESPONSES.forbidden,
        404: RESPONSES.notFound,
      },
    },
  },

  '/threads/{id}/messages': {
    post: {
      tags: ['Messagerie'],
      summary: 'Écrire dans le fil d’une prestation',
      security: BEARER,
      parameters: [bookingIdParam],
      requestBody: body('Message'),
      responses: {
        201: objectResponse('Message publié avec le rôle « traveler ».'),
        400: RESPONSES.validation,
        401: RESPONSES.unauthenticated,
        403: RESPONSES.forbidden,
        404: RESPONSES.notFound,
        409: RESPONSES.conflict,
      },
    },
  },

  '/interventions/{id}': {
    get: {
      tags: ['Fiches d’intervention'],
      summary: 'Consulter la fiche d’une prestation',
      description:
        'Le paramètre est l’identifiant de la réservation. Le voyageur n’y accède qu’une fois la fiche complétée ; tant qu’elle est pré-remplie, l’API répond SHEET_NOT_AVAILABLE.',
      security: BEARER,
      parameters: [bookingIdParam],
      responses: {
        200: objectResponse('Fiche en lecture seule.'),
        401: RESPONSES.unauthenticated,
        403: RESPONSES.forbidden,
        404: RESPONSES.notFound,
      },
    },
  },
};
