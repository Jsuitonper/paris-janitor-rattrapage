import { adminPaths, fileDeleteOperation } from './paths.admin';
import { publicPaths } from './paths.public';
import { travelerPaths } from './paths.traveler';
import { buildComponentSchemas } from './schemas';

const TAGS = [
  { name: 'Santé', description: 'Disponibilité du service.' },
  { name: 'Authentification', description: 'Inscription et ouverture de session. Jeton JWT valable 7 jours.' },
  { name: 'Compte', description: 'Profil de l’utilisateur connecté.' },
  { name: 'Catalogue public', description: 'Biens publiés, prestations actives et formules VIP. Sans authentification.' },
  { name: 'Devis', description: 'Estimation partageant le code de calcul des réservations.' },
  { name: 'Réservations', description: 'Séjours et prestations du voyageur, avec instantané tarifaire figé.' },
  { name: 'Paiements', description: 'Paiement à l’acte par Stripe PaymentIntent.' },
  { name: 'Abonnement', description: 'Formules VIP par Stripe Subscriptions.' },
  { name: 'Factures', description: 'Factures archivées en PDF, jamais régénérées.' },
  { name: 'Fichiers', description: 'Documents stockés en GridFS.' },
  { name: 'Avis', description: 'Évaluation des prestations réalisées, soumise à modération.' },
  { name: 'Messagerie', description: 'Fils de discussion rattachés aux prestations.' },
  { name: 'Fiches d’intervention', description: 'Compte rendu de prestation, pré-rempli puis complété.' },
  { name: 'Simulateur', description: 'Estimation publique de gains et collecte de demandes.' },
  { name: 'Webhooks Stripe', description: 'Réception des événements Stripe.' },
  { name: 'Administration', description: 'Back-office. Exige le rôle administrateur sur toutes les routes.' },
];

const DESCRIPTION = [
  'API de la plateforme de conciergerie Paris Janitor. Périmètre : espace voyageur et back-office d’administration.',
  '',
  '**Authentification.** Toutes les routes protégées attendent un en-tête `Authorization: Bearer <jeton>`,',
  'obtenu par `POST /api/auth/login` ou `POST /api/auth/register`. Les routes marquées d’un cadenas dans cette',
  'page l’exigent ; les autres sont ouvertes. Les routes `/api/admin/*` exigent en plus le rôle administrateur.',
  '',
  '**Erreurs.** Toute erreur suit le même format : `{ "error": { "code", "message" } }`, avec un champ `details`',
  'supplémentaire sur les erreurs de validation. Les codes sont stables et documentés route par route.',
  '',
  '**Montants.** Tous les montants sont des entiers en centimes, jamais des flottants. Les taux sont exprimés',
  'en points de base : 2000 vaut 20 %.',
  '',
  '**Instantané tarifaire.** Le prix d’une réservation est figé à sa création. Modifier ensuite un barème, un',
  'tarif ou un taux de commission ne change aucune réservation ni facture déjà émise.',
  '',
  '**Webhooks.** L’état d’abonnement et le statut de paiement ne sont écrits que par les webhooks Stripe.',
  'Aucune route applicative ne passe un utilisateur en VIP ni une réservation en payée.',
].join('\n');

export function buildOpenApiDocument(): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {
    ...(publicPaths as Record<string, Record<string, unknown>>),
    ...(travelerPaths as Record<string, Record<string, unknown>>),
    ...(adminPaths as Record<string, Record<string, unknown>>),
  };

  /* DELETE /files/{id} partage son chemin avec le GET public : on fusionne
   * l'opération plutôt que de dupliquer l'entrée. */
  paths['/files/{id}'] = { ...paths['/files/{id}'], delete: fileDeleteOperation };

  return {
    openapi: '3.0.3',
    info: {
      title: 'Paris Janitor — API',
      version: '1.0.0',
      description: DESCRIPTION,
      license: { name: 'Projet scolaire ESGI 3AL' },
    },
    servers: [
      { url: '/api', description: 'Même origine que cette page' },
      { url: 'http://localhost:3000/api', description: 'Développement local' },
    ],
    tags: TAGS,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Jeton renvoyé par /auth/login ou /auth/register, valable 7 jours. Pas de jeton de rafraîchissement.',
        },
      },
      schemas: buildComponentSchemas(),
    },
    security: [],
    paths,
  };
}
