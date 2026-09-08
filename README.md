# Paris Janitor

Plateforme de conciergerie immobilière — projet annuel 3AL (ESGI), rattrapage solo.

Périmètre réalisé : **espace Voyageurs** et **Back-office Administration**. Les espaces bailleur et prestataire ne sont pas construits, conformément aux modalités du sujet pour un étudiant seul.

## Sommaire

- [Stack](#stack)
- [Démarrage en développement](#démarrage-en-développement)
- [Variables d'environnement](#variables-denvironnement)
- [Stripe en local](#stripe-en-local)
- [Jeux de données](#jeux-de-données)
- [Tests](#tests)
- [Mise en production](#mise-en-production)
- [Architecture](#architecture)
- [Décisions structurantes](#décisions-structurantes)
- [Limites connues](#limites-connues)

## Stack

| Composant | Techno | Port dev |
|---|---|---|
| API | Node.js 22, Express 5, TypeScript, Mongoose | 3000 |
| Base de données | MongoDB 7, GridFS pour les documents | 27017 |
| Front voyageur | React 19, Vite, TypeScript | 5173 |
| Back-office admin | React 19, Vite, TypeScript | 5174 |
| Paiements | Stripe (Subscriptions + PaymentIntents) | — |
| Infra | Docker Compose, Nginx | — |

## Démarrage en développement

```bash
docker compose up -d
npm install
cp api/.env.example api/.env
```

Renseigner au minimum `JWT_SECRET` dans `api/.env` (32 caractères aléatoires suffisent), puis :

```bash
npm run seed:demo
```

Le seed refuse d'écraser des données existantes. Pour repartir de zéro :

```bash
SEED_DEMO_RESET=1 npm run seed:demo
```

Enfin, dans trois terminaux :

```bash
npm run dev:api
```

```bash
npm run dev:traveler
```

```bash
npm run dev:admin
```

Le front voyageur écoute sur http://localhost:5173, le back-office sur http://localhost:5174.

La documentation OpenAPI de l'API est servie sur http://localhost:3000/api/docs, sans authentification (source : `api/openapi.yaml`, régénérable avec `npm run docs:generate -w api`).

### Comptes de démonstration

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Administrateur | `admin@parisjanitor.fr` | `admin-1234` |
| Voyageur Free | `lea.martin@example.fr` | `demo-1234` |
| Voyageur Bag Packer | `hugo.bernard@example.fr` | `demo-1234` |
| Voyageur Explorator | `nina.rossi@example.fr` | `demo-1234` |

## Variables d'environnement

Toutes vivent dans `api/.env` et sont validées par Zod au démarrage : une variable manquante ou mal formée arrête le processus avec un message explicite plutôt que de laisser tourner une API à moitié configurée.

| Variable | Obligatoire | Rôle |
|---|---|---|
| `NODE_ENV` | non | `development`, `test` ou `production` |
| `PORT` | non | port d'écoute, 3000 par défaut |
| `MONGODB_URI` | **oui** | chaîne de connexion MongoDB |
| `JWT_SECRET` | **oui** | secret de signature des jetons, 16 caractères minimum |
| `JWT_EXPIRES_IN` | non | durée de vie des jetons, `7d` par défaut |
| `CORS_ORIGINS` | non | origines autorisées, séparées par des virgules |
| `APP_TRAVELER_URL` | non | base des URL de retour Stripe Checkout |
| `TRUST_PROXY` | non | `1` derrière un reverse proxy, sinon la limitation de débit voit l'IP du proxy |
| `STRIPE_SECRET_KEY` | non | sans elle, les routes de paiement répondent `503 STRIPE_NOT_CONFIGURED` |
| `STRIPE_PUBLISHABLE_KEY` | non | servie au front par `GET /api/payments/config` |
| `STRIPE_WEBHOOK_SECRET` | non | vérification de signature des webhooks |
| `STRIPE_PRICE_BAGPACKER_MONTHLY` | non | identifiants des quatre Prices récurrents |
| `STRIPE_PRICE_BAGPACKER_YEARLY` | non | |
| `STRIPE_PRICE_EXPLORATOR_MONTHLY` | non | |
| `STRIPE_PRICE_EXPLORATOR_YEARLY` | non | |
| `STRIPE_RENEWAL_COUPON_ID` | non | coupon de renouvellement Explorator annuel |

L'application démarre sans aucune variable Stripe : le catalogue, les réservations et le back-office fonctionnent, seules les routes de paiement et d'abonnement répondent `503`.

## Stripe en local

Créer en mode test quatre Prices récurrents (Bag Packer 9,90 €/mois et 113 €/an, Explorator 19 €/mois et 220 €/an) et un coupon `percent_off: 10`, puis activer le portail client dans Paramètres → Billing → Customer portal.

Écouter les webhooks :

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Reporter le `whsec_…` affiché dans `STRIPE_WEBHOOK_SECRET`, puis redémarrer l'API — `tsx watch` ne surveille pas `.env`.

> **Le secret de webhook de production est différent.** Celui du CLI est éphémère et propre à la session `stripe listen`. En production, il faut déclarer un endpoint dans le Dashboard Stripe (`https://votre-domaine/api/stripe/webhook`) et utiliser le secret de signature affiché sur cet endpoint.

Pour rejouer un événement réel et vérifier l'idempotence, `stripe trigger` ne convient pas : il fabrique un nouvel `event.id` à chaque appel. Utiliser :

```bash
stripe events resend evt_xxxxxxxxxxxx
```

## Jeux de données

| Commande | Effet |
|---|---|
| `npm run seed:pricing` | barème de commission (annexe 1), formules VIP (annexe 2), options du simulateur |
| `npm run seed:admin` | crée uniquement le compte administrateur |
| `npm run seed:demo` | jeu complet pour la soutenance |

Le seed de démonstration produit un état cohérent de bout en bout : 4 prestataires, 6 prestations dont une à paliers kilométriques et une réservée aux Explorator, 4 biens publiés plus 1 en attente de modération, 3 séjours passés payés et facturés, 6 prestations réalisées **avec leur fiche d'intervention complétée** (sans quoi rien ne serait clôturable et la facturation prestataire du mois serait vide), 4 avis publiés, 1 en attente et 1 refusé, 3 fils de discussion dont un sans réponse, 4 demandes de simulation à qualifier, et les factures prestataires du mois précédent déjà émises.

## Tests

```bash
npm test
```

141 tests Vitest. Le cœur métier — moteur tarifaire, commissions, avantages VIP, arithmétique en centimes, simulateur de gains — est couvert par des tests unitaires purs, sans base ni serveur. Les parcours complets passent par Supertest sur une instance `mongodb-memory-server` : catalogue et modération, réservations et non-régression tarifaire, webhooks Stripe signés, paiement à l'acte, GridFS et factures PDF, fiches d'intervention, avis, messagerie, simulateur.

```bash
npm run typecheck   # les trois workspaces
npm run lint        # API
```

Les tests n'utilisent jamais les clés Stripe réelles : `vitest.config.ts` force `STRIPE_SECRET_KEY` à vide et injecte des identifiants factices.

## Mise en production

```bash
cp .env.production.example .env.production
```

Renseigner les secrets, puis :

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Trois images sont construites : l'API (Node multi-étapes, exécutée sans les dépendances de développement, sous l'utilisateur `node`), et les deux fronts (build Vite servi par Nginx). Chaque Nginx sert son application et relaie `/api/` vers le conteneur `api`, ce qui supprime le besoin de CORS en production et permet de construire les fronts avec `VITE_API_URL=/api`.

Les deux fichiers Compose portent un nom de projet explicite, `paris-janitor-dev` et `paris-janitor-prod`. Sans cela, Docker déduit le nom du dossier et les deux piles partagent le même volume MongoDB : la production repartirait sur la base de développement, avec ses identifiants et ses données de démonstration.

MongoDB est initialisé avec un **utilisateur applicatif dédié** en `readWrite` sur la seule base `paris_janitor` : le compte `root` ne sert qu'à l'amorçage du conteneur, l'API ne l'utilise jamais. Les données vivent dans le volume nommé `mongo-data`.

Après le premier démarrage :

```bash
docker compose -f docker-compose.prod.yml exec api node dist/scripts/seed-pricing.js
```

Points de sécurité en place : `helmet`, CORS restreint aux domaines réels, en-têtes `X-Content-Type-Options`, `X-Frame-Options` et `Referrer-Policy` posés par Nginx, limitation de débit par IP sur le simulateur public, corps de requête plafonné à 12 Mo, et aucun secret dans les images — tout passe par `.env.production`, qui n'est pas commité.

L'intégration continue (`.github/workflows/ci.yml`) enchaîne typecheck des trois workspaces, lint, tests, puis construction des trois images Docker.

## Architecture

Le flux imposé est respecté partout : `route → controller → service → repository`.

- **Aucun appel Mongoose hors de `api/src/repositories/`.** Les services ne connaissent que des types métier.
- **Validation Zod dans les controllers**, jamais plus bas.
- **Erreurs uniformes** `{ error: { code, message } }`, sérialisées par un unique gestionnaire.
- **Montants toujours en centimes entiers.** Une fonction utilitaire `bpsOf` centralise les taux en points de base et lève si un flottant se glisse dans un calcul.

Le moteur tarifaire (`api/src/services/pricing/`) est volontairement pur : il n'importe ni Express ni Mongoose, ce qui le rend testable exhaustivement et permet de partager exactement le même code entre l'estimation affichée au voyageur et la réservation réellement enregistrée.

## Décisions structurantes

Ces choix ne se déduisent pas de l'énoncé. Ils ont été arbitrés en cours de route et ont chacun des conséquences visibles dans le code et les données.

### La remise VIP est absorbée par Paris Janitor

Le prestataire est rémunéré sur le **montant plein**, et la commission PJ est calculée sur ce même montant plein. Les 5 % consentis à un Explorator sortent donc de la marge de PJ, pas de la poche du prestataire. Conséquence directe : pour une prestation identique, `providerNetHtCents` est rigoureusement le même que le voyageur soit Free ou Explorator, seule la marge plateforme diffère. C'est cohérent avec le fait que PJ vend l'abonnement et en encaisse le produit.

L'alternative — appliquer la remise puis calculer la commission sur le montant remisé — a été écartée : elle fait parfois changer de palier de commission, ce qui rend la facture prestataire difficile à expliquer.

### Une prestation offerte donne lieu à une facture de 0 €

Quand le quota VIP est consommé, la réservation est marquée payée dès sa création, sans PaymentIntent, et une facture voyageur est tout de même émise. Elle porte le montant brut, la remise à 100 % et un total nul. Le voyageur dispose ainsi d'un justificatif de l'avantage utilisé, et la numérotation des factures reste continue. Le prestataire, lui, est facturé normalement à PJ : dans le jeu de démonstration, une prestation offerte à 300 € brut génère quand même un net prestataire, ce qui matérialise le coût réel de l'avantage.

### Le coupon de renouvellement est posé à la création, pas au renouvellement

L'annexe 2 accorde 10 % de remise au renouvellement de l'abonnement annuel Explorator. Le coupon Stripe est attaché à l'abonnement dès la réception de l'`invoice.paid` de **création** (`billing_reason: subscription_create`), et non à la première facture de renouvellement. Raison : un coupon posé après le paiement d'un renouvellement ne s'appliquerait qu'au renouvellement suivant, soit un an de décalage. Posé à la création, il s'applique dès la première échéance annuelle, ce que le client attend. La portée exacte se règle côté Stripe par la durée du coupon (`once` pour le seul premier renouvellement, `forever` pour tous).

### Le plafond de 80 € du Bag Packer se compare au montant TTC

L'annexe 2 parle d'« une prestation d'un montant inférieur à 80 € », l'annexe 4 exprime tous ses tarifs en TTC. Le plafond est donc comparé au **TTC**, alors que commissions et remises portent sur le HT. C'est le seul seuil du modèle exprimé en TTC, et c'est délibéré. Au-delà du plafond, la prestation n'est pas éligible et le quota reste disponible pour une prestation moins chère : le voyageur ne perd pas son avantage sur un dépassement.

### Le reversement prestataire est modélisé, sans Stripe Connect

L'espace prestataire étant hors périmètre, l'onboarding de comptes connectés n'aurait servi à rien. Le voyageur paie donc PJ par PaymentIntent classique, et le reversement est représenté par une **facture prestataire mensuelle** en PDF archivée, agrégeant les prestations réalisées du mois, dont le net à payer est la somme exacte des `providerNetHtCents` figés dans les snapshots — jamais un recalcul. Un statut de virement (`pending` / `sent`) est piloté depuis le back-office. Aucun flux bancaire réel n'est déclenché.

### La messagerie est limitée aux réservations de prestations

L'énoncé demande de pouvoir « communiquer avec le prestataire une fois le service réservé ». Les fils de discussion sont donc rattachés aux réservations de prestations, pas aux séjours. Comme l'espace prestataire n'existe pas, c'est l'administrateur qui répond, sous l'identité « Conciergerie Paris Janitor » : chaque message porte un `authorRole` (`traveler` ou `concierge`) pour que l'affichage côté voyageur reste sans ambiguïté. Étendre les fils aux séjours serait une reprise directe du même modèle.

### Autres arbitrages

- **Snapshot tarifaire figé à la réservation.** Modifier un barème, un tarif de nuitée ou un taux de commission n'altère aucune réservation ni facture passée. Le PDF d'une facture est généré une seule fois à l'émission puis archivé en GridFS : le retélécharger après un changement de tarif rend un fichier identique octet pour octet.
- **Les webhooks Stripe sont l'unique source de vérité** de l'état d'abonnement et du statut de paiement. Aucune route applicative ne passe un utilisateur en VIP ni une réservation en payé. L'idempotence est assurée en réservant l'`event.id` avant traitement.
- **La fenêtre du quota VIP est ancrée sur la date de première souscription**, pas sur le cycle de facturation Stripe : un Bag Packer payé mensuellement aurait sinon obtenu douze prestations offertes par an au lieu d'une.
- **Publier un avis est ouvert aux trois formules**, Free comprise, conformément à l'annexe 2. Le seul filtre est la modération, et seuls les avis approuvés comptent dans la note moyenne du prestataire.
- **Clôturer une prestation exige une fiche d'intervention complétée.** C'est ce qui conditionne l'éligibilité à l'avis et l'entrée dans la facture prestataire du mois.
- **Tous les documents sont en GridFS** (bucket unique `documents`, discriminé par `metadata.kind`), conformément à l'exigence de stockage en base NoSQL : factures PDF, photos de biens et pièces jointes des fiches d'intervention.

## Limites connues

- **Pas de refresh token.** Les jetons JWT vivent 7 jours ; il n'y a ni rotation, ni révocation, ni double authentification.
- **Aucune notification.** Pas d'e-mail ni de SMS : la messagerie se consulte dans l'application, en interrogation HTTP, sans temps réel.
- **Espaces bailleur et prestataire absents**, conformément au sujet. Leurs entités existent et sont pilotées par l'administrateur, qui tient le rôle des deux : validation des biens, complétion des fiches d'intervention, réponses dans la messagerie.
- **Le simulateur enregistre aussi les simulations anonymes.** En exploitation réelle, une purge périodique des leads sans coordonnées serait souhaitable.
- **Le taux de TVA est porté par chaque prestation** mais aucune logique d'exonération ni de TVA sur marge n'est implémentée. La facturation s'arrête à l'émission du document : ni écritures comptables, ni exports, ni déclarations.
- **Pas de redimensionnement d'images ni de CDN.** Chaque photo de bien transite par l'API à chaque affichage, ce qui est acceptable à l'échelle du projet mais ne tiendrait pas en charge réelle.
- **La limitation de débit est en mémoire du processus.** Elle protège une instance unique ; derrière plusieurs répliques il faudrait un magasin partagé.
