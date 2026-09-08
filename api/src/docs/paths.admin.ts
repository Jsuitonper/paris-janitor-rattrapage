import { arrayOf, BEARER, body, objectResponse, pathId, RESPONSES } from './common';
import { queryParameters } from './schemas';
import { adminBookingQuerySchema } from '../validators/booking.schema';
import { propertyListQuerySchema } from '../validators/catalog.schema';
import { interventionListQuerySchema, reviewListQuerySchema } from '../validators/engagement.schema';
import { invoiceListQuerySchema } from '../validators/file.schema';
import { leadListQuerySchema } from '../validators/simulator.schema';

const ADMIN_ERRORS = { 401: RESPONSES.unauthenticated, 403: RESPONSES.forbidden };
const T = ['Administration'];

function collection(summary: string, itemsDescription: string, parameters: unknown[] = []): unknown {
  return { tags: T, summary, security: BEARER, ...(parameters.length ? { parameters } : {}), responses: { 200: arrayOf(itemsDescription), ...ADMIN_ERRORS } };
}

function create(summary: string, schemaName: string, created: string): unknown {
  return {
    tags: T,
    summary,
    security: BEARER,
    requestBody: body(schemaName),
    responses: { 201: objectResponse(created), 400: RESPONSES.validation, ...ADMIN_ERRORS, 404: RESPONSES.notFound, 409: RESPONSES.conflict },
  };
}

function patch(summary: string, schemaName: string, updated: string, param = pathId()): unknown {
  return {
    tags: T,
    summary,
    security: BEARER,
    parameters: [param],
    requestBody: body(schemaName),
    responses: { 200: objectResponse(updated), 400: RESPONSES.validation, ...ADMIN_ERRORS, 404: RESPONSES.notFound, 409: RESPONSES.conflict },
  };
}

function remove(summary: string, note?: string): unknown {
  return {
    tags: T,
    summary,
    ...(note ? { description: note } : {}),
    security: BEARER,
    parameters: [pathId()],
    responses: { 204: { description: 'Supprimé.' }, ...ADMIN_ERRORS, 404: RESPONSES.notFound, 409: RESPONSES.conflict },
  };
}

function readOne(summary: string, found: string): unknown {
  return {
    tags: T,
    summary,
    security: BEARER,
    parameters: [pathId()],
    responses: { 200: objectResponse(found), ...ADMIN_ERRORS, 404: RESPONSES.notFound },
  };
}

const MULTIPART_PHOTO = {
  required: true,
  content: {
    'multipart/form-data': {
      schema: {
        type: 'object',
        required: ['file'],
        properties: { file: { type: 'string', format: 'binary', description: 'Image JPEG, PNG ou WebP, 10 Mo maximum.' } },
      },
    },
  },
};

export const adminPaths: Record<string, unknown> = {
  '/admin/users': { get: collection('Lister les comptes', 'Comptes voyageurs et administrateurs, sans empreinte de mot de passe.') },

  '/admin/providers': {
    get: collection('Lister les prestataires', 'Prestataires avec leur note cumulée.'),
    post: create('Créer un prestataire', 'Provider', 'Prestataire créé.'),
  },
  '/admin/providers/{id}': {
    get: readOne('Consulter un prestataire', 'Prestataire.'),
    patch: patch('Modifier un prestataire', 'ProviderPatch', 'Prestataire modifié.'),
    delete: remove('Supprimer un prestataire'),
  },

  '/admin/categories': {
    get: collection('Lister les catégories', 'Catégories de prestations.'),
    post: create('Créer une catégorie', 'ServiceCategory', 'Catégorie créée. Le slug doit être unique.'),
  },
  '/admin/categories/{id}': {
    patch: patch('Modifier une catégorie', 'ServiceCategoryPatch', 'Catégorie modifiée.'),
    delete: remove('Supprimer une catégorie', 'Refusé si des prestations l’utilisent encore.'),
  },

  '/admin/offerings': {
    get: collection('Lister les prestations', 'Toutes les prestations, actives ou non.'),
    post: create('Créer une prestation', 'ServiceOffering', 'Prestation créée. Les paliers du barème doivent être strictement croissants et se terminer par un palier ouvert.'),
  },
  '/admin/offerings/{id}': {
    get: readOne('Consulter une prestation', 'Prestation.'),
    patch: patch('Modifier une prestation', 'ServiceOfferingPatch', 'Prestation modifiée. Sans effet sur les réservations passées.'),
    delete: remove('Supprimer une prestation'),
  },

  '/admin/properties': {
    get: collection('Lister les biens', 'Biens, tous statuts confondus.', queryParameters(propertyListQuerySchema)),
    post: create('Créer un bien', 'Property', 'Bien créé, en attente de validation par défaut.'),
  },
  '/admin/properties/{id}': {
    get: readOne('Consulter un bien', 'Bien.'),
    patch: patch('Modifier un bien', 'PropertyPatch', 'Bien modifié. Sans effet sur les séjours passés.'),
    delete: remove('Supprimer un bien'),
  },
  '/admin/properties/{id}/status': {
    patch: patch('Modérer un bien', 'PropertyStatus', 'Statut appliqué. Seul « published » rend le bien visible au public.'),
  },
  '/admin/properties/{id}/photos': {
    post: {
      tags: T,
      summary: 'Ajouter une photo à un bien',
      description: 'Stockée en GridFS avec metadata.kind « property_photo », puis rattachée au bien.',
      security: BEARER,
      parameters: [pathId()],
      requestBody: MULTIPART_PHOTO,
      responses: { 201: objectResponse('Bien mis à jour avec la nouvelle photo.'), 400: RESPONSES.validation, ...ADMIN_ERRORS, 404: RESPONSES.notFound, 413: { description: 'FILE_TOO_LARGE — au-delà de 10 Mo.' } },
    },
  },
  '/admin/properties/{id}/photos/{fileId}': {
    delete: {
      tags: T,
      summary: 'Retirer une photo d’un bien',
      security: BEARER,
      parameters: [pathId(), pathId('fileId', 'Identifiant GridFS de la photo.')],
      responses: { 200: objectResponse('Bien mis à jour.'), ...ADMIN_ERRORS, 404: RESPONSES.notFound },
    },
  },

  '/admin/pricing/commission-tiers': {
    get: collection('Lire le barème de commission', 'Paliers de l’annexe 1, bornes inférieures incluses.'),
    put: {
      tags: T,
      summary: 'Remplacer le barème de commission',
      description: 'Sans effet rétroactif : les réservations et factures déjà émises conservent leur instantané.',
      security: BEARER,
      requestBody: body('CommissionTiers'),
      responses: { 200: arrayOf('Barème enregistré.'), 400: RESPONSES.validation, ...ADMIN_ERRORS },
    },
  },
  '/admin/pricing/vip-plans': { get: collection('Lire les formules VIP', 'Formules de l’annexe 2.') },
  '/admin/pricing/vip-plans/{tier}': {
    patch: patch('Modifier une formule VIP', 'VipPlanPatch', 'Formule modifiée.', {
      name: 'tier',
      in: 'path',
      required: true,
      schema: { type: 'string', enum: ['free', 'bagpacker', 'explorator'] },
    }),
  },
  '/admin/pricing/settings': {
    get: { tags: T, summary: 'Lire les paramètres plateforme', security: BEARER, responses: { 200: objectResponse('Commission sur les nuitées, abonnement bailleur, options du simulateur.'), ...ADMIN_ERRORS } },
    patch: {
      tags: T,
      summary: 'Modifier les paramètres plateforme',
      security: BEARER,
      requestBody: body('PlatformSettingsPatch'),
      responses: { 200: objectResponse('Paramètres enregistrés.'), 400: RESPONSES.validation, ...ADMIN_ERRORS },
    },
  },
  '/admin/pricing/preview': {
    post: {
      tags: T,
      summary: 'Calculer un prix depuis un barème',
      description: 'Aperçu pour l’éditeur de barème : applique le moteur tarifaire sans rien enregistrer.',
      security: BEARER,
      requestBody: body('PricePreview'),
      responses: { 200: objectResponse('Montant hors taxes en centimes.'), 400: RESPONSES.validation, ...ADMIN_ERRORS },
    },
  },

  '/admin/bookings/stays': { get: collection('Lister les séjours', 'Séjours de tous les voyageurs.', queryParameters(adminBookingQuerySchema)) },
  '/admin/bookings/stays/{id}/status': { patch: patch('Changer le statut d’un séjour', 'BookingStatus', 'Statut appliqué.') },
  '/admin/bookings/services': { get: collection('Lister les prestations réservées', 'Prestations de tous les voyageurs.', queryParameters(adminBookingQuerySchema)) },
  '/admin/bookings/services/{id}/status': {
    patch: patch('Changer le statut d’une prestation', 'BookingStatus', 'Statut appliqué. Passer à « confirmed » crée la fiche d’intervention pré-remplie ; passer à « completed » exige une fiche complétée.'),
  },

  '/admin/subscriptions': { get: collection('Lister les abonnés', 'État VIP projeté depuis les webhooks Stripe, en lecture seule.') },
  '/admin/payments': { get: collection('Lister les règlements', 'Règlements et leur statut projeté depuis les webhooks.') },

  '/admin/invoices': { get: collection('Lister les factures', 'Factures voyageur et prestataire.', queryParameters(invoiceListQuerySchema)) },
  '/admin/invoices/provider-payouts': {
    post: {
      tags: T,
      summary: 'Émettre les factures prestataires d’un mois',
      description:
        'Agrège les prestations réalisées de la période par prestataire. Le net à payer est la somme des montants figés dans les instantanés, jamais un recalcul. Relancer le même mois n’émet pas de doublon.',
      security: BEARER,
      requestBody: body('ProviderPayoutPeriod'),
      responses: { 201: objectResponse('Objet { created, skipped }.'), 400: RESPONSES.validation, ...ADMIN_ERRORS },
    },
  },
  '/admin/invoices/{id}/payout': {
    patch: patch('Marquer le virement d’une facture prestataire', 'PayoutStatus', 'Statut de virement appliqué. Refusé sur une facture voyageur.'),
  },

  '/admin/interventions': { get: collection('Lister les fiches d’intervention', 'Fiches pré-remplies et complétées.', queryParameters(interventionListQuerySchema)) },
  '/admin/interventions/{id}/complete': {
    patch: patch('Compléter une fiche d’intervention', 'InterventionReport', 'Fiche complétée. La prestation devient clôturable et la fiche visible par le voyageur.', pathId('id', 'Identifiant de la fiche, pas de la réservation.')),
  },

  '/admin/reviews': { get: collection('Lister les avis', 'Avis à modérer et déjà traités.', queryParameters(reviewListQuerySchema)) },
  '/admin/reviews/{id}/moderation': {
    patch: patch('Modérer un avis', 'ReviewModeration', 'Décision appliquée. La note du prestataire est recalculée sur les seuls avis approuvés.'),
  },

  '/admin/threads': { get: collection('Boîte de réception', 'Fils de discussion avec leurs compteurs de non-lus.') },
  '/admin/threads/{id}': {
    get: {
      tags: T,
      summary: 'Lire un fil',
      description: 'Le paramètre est l’identifiant de la réservation.',
      security: BEARER,
      parameters: [pathId('id', 'Identifiant de la réservation de prestation.')],
      responses: { 200: objectResponse('Objet { thread, messages }.'), ...ADMIN_ERRORS, 404: RESPONSES.notFound },
    },
  },
  '/admin/threads/{id}/messages': {
    post: {
      tags: T,
      summary: 'Répondre au nom de la conciergerie',
      description: 'Le message porte le rôle « concierge », l’espace prestataire étant hors périmètre.',
      security: BEARER,
      parameters: [pathId('id', 'Identifiant de la réservation de prestation.')],
      requestBody: body('Message'),
      responses: { 201: objectResponse('Message publié.'), 400: RESPONSES.validation, ...ADMIN_ERRORS, 404: RESPONSES.notFound, 409: RESPONSES.conflict },
    },
  },

  '/admin/leads': { get: collection('Lister les demandes de simulation', 'Demandes, avec ou sans coordonnées.', queryParameters(leadListQuerySchema)) },
  '/admin/leads/export.csv': {
    get: {
      tags: T,
      summary: 'Exporter les demandes en CSV',
      security: BEARER,
      responses: {
        200: { description: 'Fichier CSV séparé par points-virgules.', content: { 'text/csv': { schema: { type: 'string' } } } },
        ...ADMIN_ERRORS,
      },
    },
  },
  '/admin/leads/{id}': { patch: patch('Qualifier une demande', 'LeadQualification', 'Demande mise à jour.') },

  '/files': {
    post: {
      tags: ['Fichiers'],
      summary: 'Téléverser un document',
      description: 'Réservé aux administrateurs. Le type MIME doit appartenir à la liste autorisée pour le « kind » demandé.',
      security: BEARER,
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['file', 'kind'],
              properties: {
                file: { type: 'string', format: 'binary' },
                kind: { type: 'string', enum: ['property_photo', 'booking_attachment', 'inventory_report'] },
                ownerUserId: { type: 'string', pattern: '^[0-9a-f]{24}$' },
                propertyId: { type: 'string', pattern: '^[0-9a-f]{24}$' },
                bookingId: { type: 'string', pattern: '^[0-9a-f]{24}$' },
              },
            },
          },
        },
      },
      responses: {
        201: objectResponse('Document stocké en GridFS.'),
        400: RESPONSES.validation,
        ...ADMIN_ERRORS,
        413: { description: 'FILE_TOO_LARGE — au-delà de 10 Mo.' },
      },
    },
  },
};

/* La suppression d'un fichier partage le chemin GET /files/{id}, décrit côté
 * public. On l'ajoute ici pour ne pas dupliquer l'entrée du chemin. */
export const fileDeleteOperation = {
  tags: ['Fichiers'],
  summary: 'Supprimer un document',
  description: 'Réservé aux administrateurs. Suppression définitive dans GridFS.',
  security: BEARER,
  parameters: [pathId()],
  responses: { 204: { description: 'Document supprimé.' }, ...ADMIN_ERRORS, 404: RESPONSES.notFound },
};
