# Déploiement sur Railway

Procédure complète pour déployer Paris Janitor sur Railway à partir du dépôt
`github.com/Jsuitonper/aris-janitor-rattrapage`, en quatre services : MongoDB, `api`,
`web-traveler`, `web-admin`.

Ce document suppose que tu ne connais pas Railway. Chaque réglage est donné avec son
emplacement exact dans l'interface.

---

## 1. Pourquoi le service unique a échoué

Quand on connecte un dépôt GitHub, Railway crée **un seul service** et le construit
depuis la racine du dépôt. Or cette racine est un monorepo npm workspaces : elle ne
contient aucun `Dockerfile`, et trois applications avec trois commandes de démarrage
différentes. Le constructeur automatique de Railway n'a donc rien de démarrable à
produire, et le build s'arrête.

Le dépôt contient bien trois Dockerfiles — `api/Dockerfile`, `web-traveler/Dockerfile`,
`web-admin/Dockerfile` — mais chacun attend **la racine du dépôt comme contexte de
build**. Leurs premières instructions le montrent :

```dockerfile
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY web-traveler/package.json web-traveler/package.json
COPY web-admin/package.json web-admin/package.json
RUN npm ci
```

Ces fichiers n'existent pas à l'intérieur de `api/` ou de `web-traveler/`. D'où la règle
la plus importante de toute cette procédure :

> **Le Root Directory des trois services reste `/` (valeur par défaut, à ne pas
> modifier).** On ne le met ni à `api`, ni à `web-traveler`, ni à `web-admin`.
> On désigne le Dockerfile à utiliser avec la variable `RAILWAY_DOCKERFILE_PATH`.

C'est contre-intuitif : la documentation Railway présente le Root Directory comme la
solution aux monorepos, mais elle vise les *monorepos isolés*, où chaque dossier est
autonome. Ici on a un *monorepo partagé* (workspaces npm, un seul `package-lock.json`
à la racine), et changer le Root Directory ferait échouer le build à la première ligne
avec `"/package.json": not found`.

---

## 2. Architecture cible

| Service | Source | Rôle | Domaine public |
|---|---|---|---|
| `mongo` | Base Railway | MongoDB 7 + GridFS (fichiers, PDF de factures) | non |
| `api` | `api/Dockerfile` | Express, port 3000 | oui — nécessaire au webhook Stripe |
| `web-traveler` | `web-traveler/Dockerfile` | SPA React servie par nginx | oui |
| `web-admin` | `web-admin/Dockerfile` | SPA React servie par nginx | oui |

Les deux fronts appellent l'API **en direct, sur son domaine public**. Il n'y a pas de
reverse proxy interne comme dans `docker-compose.prod.yml` : sur Railway chaque service
a son propre domaine, et l'API doit de toute façon être publique pour recevoir les
webhooks Stripe. C'est donc `CORS_ORIGINS` qui autorise l'appel, pas nginx.

Le réseau privé Railway (`*.railway.internal`) n'est utilisé que pour un seul lien :
`api` → `mongo`. La base n'est jamais exposée publiquement, sauf temporairement pour
lancer le seed (section 10).

---

## 3. Modifications apportées au dépôt

Railway impose deux contraintes que les images nginx du dépôt ne satisfaisaient pas.
Les corrections sont déjà appliquées ; cette section explique ce qui a changé et
pourquoi, pour que tu puisses le justifier en soutenance.

### 3.1 nginx doit écouter sur un port variable

Railway attribue le port d'écoute par variable d'environnement. `nginx/spa.conf`
contenait `listen 80;` en dur. Le fichier devient un *template* : l'image officielle
nginx passe automatiquement tout fichier `/etc/nginx/templates/*.template` dans
`envsubst` au démarrage du conteneur.

`nginx/spa.conf` → `nginx/spa.conf.template`, avec `listen ${PORT};`.

`envsubst` ne substitue que les variables réellement définies dans l'environnement :
les variables propres à nginx (`$uri`, `$host`, `$proxy_add_x_forwarded_for`) sont
préservées. Vérifié sur l'image construite :

```
listen 8090;
...
try_files $uri $uri/ /index.html;
```

### 3.2 Le bloc proxy `/api/` empêche nginx de démarrer sur Railway

`spa.conf` proxyfiait `/api/` vers `http://api:3000/api/`, l'hôte `api` du réseau
Docker Compose. Sur Railway cet hôte n'existe pas, et nginx **refuse de démarrer** s'il
ne peut pas résoudre un upstream déclaré en dur. Vérifié :

```
nginx: [emerg] host not found in upstream "api" in /etc/nginx/conf.d/default.conf:15
nginx: configuration file /etc/nginx/nginx.conf test failed
```

Le service serait donc resté en échec de démarrage sans message explicite côté Railway.
D'où un second template, `nginx/spa-standalone.conf.template`, identique mais **sans le
bloc `location /api/`** : le front sert uniquement les fichiers statiques, et le
navigateur appelle l'API sur son propre domaine.

Le choix entre les deux templates se fait par argument de build :

```dockerfile
FROM nginx:1.27-alpine AS runtime
ARG NGINX_TEMPLATE=nginx/spa.conf.template
COPY ${NGINX_TEMPLATE} /etc/nginx/templates/default.conf.template
COPY --from=build /app/web-traveler/dist /usr/share/nginx/html
ENV PORT=80
EXPOSE 80
```

La valeur par défaut est le template **avec** proxy : `docker-compose.prod.yml` et la
procédure VPS de [`deploiement.md`](deploiement.md) continuent de fonctionner à
l'identique, sans aucune modification. Vérifié : image construite sans argument →
`listen 80;` et `proxy_pass http://api:3000/api/;` toujours présents.

Sur Railway on surcharge par la variable de service `NGINX_TEMPLATE`.

### 3.3 Récapitulatif des fichiers touchés

| Fichier | Changement |
|---|---|
| `nginx/spa.conf` | renommé en `nginx/spa.conf.template`, `listen ${PORT};` |
| `nginx/spa-standalone.conf.template` | **nouveau** — sans le bloc `location /api/` |
| `web-traveler/Dockerfile` | `ARG NGINX_TEMPLATE`, copie vers `/etc/nginx/templates/`, `ENV PORT=80` |
| `web-admin/Dockerfile` | idem |

`api/Dockerfile` est inchangé : l'API lit déjà `PORT` par sa configuration
(`api/src/config/env.ts`) et écoute sur toutes les interfaces.

---

## 4. Préalables

- Un compte Railway avec un plan actif. Quatre services tournent en continu : vérifie
  ton plan et tes crédits avant de commencer, une base de données arrêtée en cours de
  soutenance est difficile à rattraper.
- Le dépôt à jour sur GitHub, branche `main`, incluant les modifications de la
  section 3.
- Un compte Stripe avec les 4 prix, le coupon et le portail client déjà configurés
  (voir [`deploiement.md`](deploiement.md), section Stripe).
- Node 22 en local, pour lancer le seed distant (section 10).

---

## 5. Étape 1 — repartir d'un projet propre

Le service créé automatiquement pointe sur la racine et ne peut pas aboutir. Le plus
simple est de le supprimer plutôt que de le reconfigurer.

1. Ouvre le projet sur `railway.com`.
2. Clic sur le service en échec → onglet **Settings** → tout en bas, section
   **Danger** → **Delete Service** (ou **Remove Service**), confirme en saisissant le
   nom du service.

Supprimer un service ne supprime pas le projet. Tu gardes le projet, son nom et son
environnement `production`.

Si tu préfères le conserver, tu peux aussi le renommer `api` et lui appliquer
directement la configuration de l'étape 3 : le résultat est le même.

---

## 6. Étape 2 — MongoDB

À faire en premier : l'API a besoin de son URL, et une base vide se provisionne en
quelques secondes.

1. Sur le canvas du projet, bouton **+ New** (ou `Ctrl + K`) → **Database** →
   **Add MongoDB**.
2. Railway crée un service nommé `MongoDB` (parfois `Mongo`), avec son volume
   persistant. **Note le nom exact tel qu'il apparaît sur le canvas** : il sert de
   préfixe dans les variables de référence de l'étape suivante. Ce document utilise
   `MongoDB`.
3. Ouvre le service → onglet **Variables**. Railway y a généré :

| Variable | Contenu |
|---|---|
| `MONGOHOST` | hôte interne |
| `MONGOPORT` | port interne, `27017` |
| `MONGOUSER` | utilisateur racine, en général `mongo` |
| `MONGOPASSWORD` | mot de passe généré |
| `MONGO_URL` | URL de connexion **privée**, complète |
| `MONGO_PUBLIC_URL` | URL **publique**, n'existe qu'après activation de l'accès public |

Ne modifie rien ici. Ne crée pas d'utilisateur applicatif dédié comme dans la procédure
VPS : sur Railway la base n'est jamais exposée, l'utilisateur racine généré suffit.

> **Volume.** Le volume attaché à ce service contient toute la base, GridFS compris —
> donc les PDF de factures archivés. Le supprimer est irréversible.

---

## 7. Étape 3 — Service `api`

### 7.1 Créer le service

1. Canvas → **+ New** → **GitHub Repo** → sélectionne
   `Jsuitonper/aris-janitor-rattrapage`.
   Si Railway n'a pas accès au dépôt, il propose **Configure GitHub App** : autorise-le
   sur ce dépôt.
2. Railway crée le service et lance immédiatement un build **qui va échouer**. C'est
   normal, il n'est pas encore configuré. Laisse-le finir ou annule-le.
3. Renomme le service : clic sur le service → **Settings** → champ **Service Name** →
   `api`. Ce nom est utilisé tel quel dans les variables de référence.

### 7.2 Ne pas toucher au Root Directory

**Settings → Source → Root Directory** : laisser vide (`/`).
C'est le point expliqué en section 1.

### 7.3 Variables

Onglet **Variables** → **+ New Variable** pour chacune. Le mode **Raw Editor** permet
de tout coller d'un coup au format `CLE=valeur`.

| Variable | Valeur | Origine |
|---|---|---|
| `RAILWAY_DOCKERFILE_PATH` | `api/Dockerfile` | désigne le Dockerfile, contexte = racine |
| `NODE_ENV` | `production` | |
| `PORT` | `3000` | port d'écoute de l'API |
| `TRUST_PROXY` | `1` | l'API est derrière le proxy Railway ; sans ça le rate limiting du simulateur voit une seule IP |
| `MONGODB_URI` | voir 7.4 | |
| `JWT_SECRET` | voir 7.5 | |
| `JWT_EXPIRES_IN` | `7d` | |
| `APP_TRAVELER_URL` | *à remplir à l'étape 6* | URL de retour Stripe Checkout |
| `CORS_ORIGINS` | *à remplir à l'étape 6* | |
| `STRIPE_SECRET_KEY` | `sk_...` | Dashboard Stripe → Développeurs → Clés API |
| `STRIPE_PUBLISHABLE_KEY` | `pk_...` | idem — servie au front par `GET /api/payments/config`, pas de variable côté front |
| `STRIPE_WEBHOOK_SECRET` | *à remplir à l'étape 9* | `whsec_...` du nouvel endpoint |
| `STRIPE_PRICE_BAGPACKER_MONTHLY` | `price_...` | Catalogue Stripe |
| `STRIPE_PRICE_BAGPACKER_YEARLY` | `price_...` | |
| `STRIPE_PRICE_EXPLORATOR_MONTHLY` | `price_...` | |
| `STRIPE_PRICE_EXPLORATOR_YEARLY` | `price_...` | |
| `STRIPE_RENEWAL_COUPON_ID` | `renewal-10` | id du coupon 10 % |

`APP_TRAVELER_URL` et `CORS_ORIGINS` référencent les fronts, qui n'existent pas encore.
On les remplit à l'étape 6, une fois les trois services créés.

### 7.4 `MONGODB_URI`

Deux écritures possibles. La forme explicite est préférable, elle ne dépend pas du
format exact de `MONGO_URL` :

```
MONGODB_URI=mongodb://${{ MongoDB.MONGOUSER }}:${{ MongoDB.MONGOPASSWORD }}@${{ MongoDB.RAILWAY_PRIVATE_DOMAIN }}:27017/paris_janitor?authSource=admin
```

La syntaxe `${{ Service.VARIABLE }}` est celle des *variables de référence* Railway :
la valeur est résolue au déploiement, et le service est redéployé si elle change.
Remplace `MongoDB` par le nom exact du service de l'étape 2. Le champ de saisie propose
une autocomplétion qui insère la référence correcte.

Deux points à ne pas rater :

- **`/paris_janitor`** — sans nom de base dans l'URL, Mongoose se connecte à la base
  `test`. Le seed et l'application marcheraient, mais dans une base au nom absurde.
- **`?authSource=admin`** — l'utilisateur est créé dans la base `admin`. Sans ce
  paramètre, l'authentification est tentée contre `paris_janitor` et échoue avec
  `MongoServerError: Authentication failed`.

Pour vérifier ce que contient réellement `MONGO_URL`, ouvre le service MongoDB → onglet
**Variables** → icône œil sur la valeur.

### 7.5 `JWT_SECRET`

Doit faire au moins 16 caractères, sinon l'API refuse de démarrer. Génère-en un :

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

N'utilise pas celui de ton `.env` local.

### 7.6 Domaine public et healthcheck

1. **Settings → Networking → Public Networking → Generate Domain**.
   Railway attribue un domaine de la forme `api-production-xxxx.up.railway.app`.
   Si un champ **Target Port** est demandé, indique `3000`.
2. **Settings → Deploy → Healthcheck Path** → `/api/health`.
   Railway interroge cette route après chaque déploiement et ne bascule le trafic que
   sur une réponse `2xx`. Un déploiement qui ne démarre pas est alors marqué en échec
   au lieu de rester en ligne à moitié cassé.
3. Déclenche un déploiement : bouton **Deploy** en haut (les modifications de variables
   sont mises en attente et appliquées ensemble).

### 7.7 Vérifier

Une fois le déploiement vert :

```bash
curl https://api-production-xxxx.up.railway.app/api/health
```

Réponse attendue : `{"status":"ok","db":"connected"}`.

Si `db` n'est pas `connected`, le problème est dans `MONGODB_URI` — voir section 12.

La documentation OpenAPI est également accessible, sans authentification :
`https://api-production-xxxx.up.railway.app/api/docs`.

**Note le domaine de l'API, il est nécessaire aux deux étapes suivantes.**

---

## 8. Étapes 4 et 5 — Services `web-traveler` et `web-admin`

### 8.1 Le problème de `VITE_API_URL`

Vite n'a pas de configuration au démarrage : il **remplace `import.meta.env.VITE_API_URL`
par sa valeur littérale au moment du build**, et cette valeur se retrouve écrite en dur
dans le bundle JavaScript. Modifier la variable sur un conteneur déjà construit ne
change rien.

```ts
// web-traveler/src/api/client.ts
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
```

Deux conséquences.

**D'abord, la variable doit atteindre le build.** Railway expose les variables du
service au moment du build, mais un build Docker ne les reçoit que si le Dockerfile les
déclare explicitement avec `ARG`. C'est déjà le cas :

```dockerfile
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w web-traveler
```

**Ensuite, le domaine de l'API doit exister avant ce build.** D'où l'ordre imposé :
l'API est créée et son domaine généré à l'étape 3, les fronts seulement après. La
valeur s'écrit alors comme une variable de référence :

```
VITE_API_URL=https://${{ api.RAILWAY_PUBLIC_DOMAIN }}/api
```

`api` est le nom du service renommé en 7.1. Railway résout la référence au moment du
build et Vite l'inscrit dans le bundle.

> **À retenir pour la suite :** si le domaine de l'API change un jour (domaine
> personnalisé, service recréé), il ne suffit pas de redémarrer les fronts. Il faut les
> **reconstruire** : service → menu du déploiement → **Redeploy**. Un simple restart
> resservirait l'ancien bundle avec l'ancienne URL.

Le `/api` final fait partie de l'URL : le client HTTP concatène directement les chemins
(`/bookings`, `/auth/login`). Ne mets pas de barre oblique finale.

### 8.2 Créer `web-traveler`

1. Canvas → **+ New** → **GitHub Repo** → le même dépôt.
2. **Settings → Service Name** → `web-traveler`.
3. **Settings → Source → Root Directory** → laisser vide.
4. Onglet **Variables** :

| Variable | Valeur |
|---|---|
| `RAILWAY_DOCKERFILE_PATH` | `web-traveler/Dockerfile` |
| `NGINX_TEMPLATE` | `nginx/spa-standalone.conf.template` |
| `VITE_API_URL` | `https://${{ api.RAILWAY_PUBLIC_DOMAIN }}/api` |
| `PORT` | `80` |

`NGINX_TEMPLATE` sélectionne la configuration sans proxy `/api/` (section 3.2). Sans
elle, le conteneur ne démarrera pas.

`PORT=80` est fixé explicitement pour que le port d'écoute ne dépende pas de la
détection automatique de Railway : c'est aussi la valeur par défaut de l'image.

5. **Settings → Networking → Public Networking → Generate Domain**.
   Si un **Target Port** est demandé, indique `80`.
6. **Deploy**.

### 8.3 Créer `web-admin`

Identique, en remplaçant les valeurs :

| Variable | Valeur |
|---|---|
| `RAILWAY_DOCKERFILE_PATH` | `web-admin/Dockerfile` |
| `NGINX_TEMPLATE` | `nginx/spa-standalone.conf.template` |
| `VITE_API_URL` | `https://${{ api.RAILWAY_PUBLIC_DOMAIN }}/api` |
| `PORT` | `80` |

Puis génération du domaine et déploiement.

### 8.4 Limiter les rebuilds inutiles (optionnel)

Les trois services pointent sur le même dépôt : chaque `git push` déclenche trois
builds. Pour l'éviter, **Settings → Build → Watch Paths** accepte des motifs de type
`.gitignore` :

- `api` : `api/**`, `package.json`, `package-lock.json`
- `web-traveler` : `web-traveler/**`, `nginx/**`, `package.json`, `package-lock.json`
- `web-admin` : `web-admin/**`, `nginx/**`, `package.json`, `package-lock.json`

Inclure `package-lock.json` est nécessaire : les trois images font `npm ci` depuis la
racine. À ne configurer qu'une fois le déploiement stabilisé — un motif trop restrictif
donne l'impression qu'un correctif n'est pas pris en compte.

---

## 9. Étape 6 — Boucler `CORS_ORIGINS` et `APP_TRAVELER_URL`

Les fronts appellent l'API depuis une origine différente. Sans autorisation explicite,
le navigateur bloque chaque requête et l'application reste vide, sans erreur visible
côté serveur.

Retourne sur le service `api` → onglet **Variables**, et complète les deux variables
laissées en attente :

```
CORS_ORIGINS=https://${{ web-traveler.RAILWAY_PUBLIC_DOMAIN }},https://${{ web-admin.RAILWAY_PUBLIC_DOMAIN }}
APP_TRAVELER_URL=https://${{ web-traveler.RAILWAY_PUBLIC_DOMAIN }}
```

Ce que doit contenir `CORS_ORIGINS` :

- les **origines** des deux fronts, séparées par une virgule sans espace ;
- le schéma `https://` inclus ;
- **aucun chemin, aucune barre oblique finale** — `https://front.up.railway.app/` ou
  `.../accueil` ne correspondront à aucune requête. Une origine, au sens du navigateur,
  c'est schéma + hôte + port, rien d'autre ;
- le domaine de l'API ne s'y met pas : une origine n'a pas à s'autoriser elle-même.

`APP_TRAVELER_URL` sert aux URL de retour de Stripe Checkout et du portail client
(`/account?checkout=success`, `/vip?checkout=cancelled`). Elle pointe donc sur le front
voyageur, sans barre oblique finale, sinon les URL générées contiennent `//account`.

Applique les changements avec **Deploy**. Railway redéploie l'API.

Vérifie ensuite depuis le front voyageur : ouvre son domaine, console du navigateur,
et connecte-toi. Une erreur `blocked by CORS policy` signifie que l'origine listée ne
correspond pas exactement à celle du navigateur.

---

## 10. Étape 7 — Webhook Stripe

Les webhooks sont la seule source de vérité de l'état VIP et du statut de paiement :
sans cet endpoint, un abonnement payé ne passe jamais actif et une réservation payée
reste impayée en base.

### 10.1 Déclarer l'endpoint

1. Dashboard Stripe → **Développeurs** → **Webhooks** → **Ajouter un endpoint**.
2. URL : `https://api-production-xxxx.up.railway.app/api/stripe/webhook`
   — le domaine public du service `api`, suffixé de `/api/stripe/webhook`.
3. Sélectionne les 9 événements traités par l'application :

```
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
payment_intent.succeeded
payment_intent.payment_failed
payment_intent.canceled
```

4. Crée l'endpoint.

### 10.2 Récupérer le nouveau `whsec_`

Sur la page de l'endpoint, section **Clé secrète de signature** → **Révéler**. La valeur
commence par `whsec_`.

> **Ce secret n'est pas celui de ton poste de développement.** Celui qu'affiche
> `stripe listen` est propre au CLI et n'est valable que pour lui. Chaque endpoint
> déclaré dans le Dashboard a le sien. Utiliser le mauvais produit un `400` sur chaque
> événement, avec `Webhook signature verification failed`.

Reporte-le sur le service `api` → **Variables** → `STRIPE_WEBHOOK_SECRET`, puis
**Deploy**.

### 10.3 Vérifier

Sur la page de l'endpoint Stripe, bouton **Envoyer un événement de test** →
`payment_intent.succeeded`. Stripe doit afficher une réponse `200`.

Côté Railway, service `api` → onglet **Deployments** → **View Logs** pour voir la
requête arriver.

Un `200` accompagné de `duplicate` dans la réponse est normal si l'événement a déjà été
traité : c'est le mécanisme d'idempotence (`StripeEvent._id = event.id`).

---

## 11. Étape 8 — Lancer le seed sur la base distante

La base est vide : sans seed, aucune formule VIP, aucun barème de commission, aucun
compte administrateur. `GET /api/catalog/offerings` renvoie d'ailleurs une erreur tant
que les barèmes ne sont pas en base.

Deux méthodes. La première ne demande aucune installation.

### 11.1 Méthode A — depuis ton poste, via l'accès public temporaire

1. Service MongoDB → **Settings → Networking → Public Networking** → active l'accès
   public. Railway crée un proxy TCP et renseigne `MONGO_PUBLIC_URL`.
2. Onglet **Variables** du service MongoDB → copie `MONGO_PUBLIC_URL`. Elle ressemble à
   `mongodb://mongo:MOTDEPASSE@yamabiko.proxy.rlwy.net:41234`.
3. Dans PowerShell, à la racine du dépôt :

```powershell
$env:MONGODB_URI = "mongodb://mongo:MOTDEPASSE@yamabiko.proxy.rlwy.net:41234/paris_janitor?authSource=admin"
$env:JWT_SECRET = "seed-uniquement-mais-16-caracteres-minimum"
$env:SEED_ADMIN_EMAIL = "admin@parisjanitor.fr"
$env:SEED_ADMIN_PASSWORD = "choisis-un-vrai-mot-de-passe"
npm run seed:demo -w api
```

Reprends l'URL publique **en lui ajoutant `/paris_janitor?authSource=admin`**, comme en
7.4 : `MONGO_PUBLIC_URL` ne contient ni nom de base ni source d'authentification.

Le script refuse d'écraser des données existantes. Pour repartir de zéro, ajoute
`$env:SEED_DEMO_RESET = "1"`.

`JWT_SECRET` est exigé par la validation de configuration au démarrage du script, mais
n'a aucun effet sur les données produites : le seed ne signe aucun jeton. Sa valeur ici
est sans importance, elle n'a pas à correspondre à celle de l'API.

4. **Désactive l'accès public** une fois le seed terminé : même écran, **Remove**. Le
   proxy TCP expose la base à Internet avec un simple couple identifiant / mot de passe,
   et il est facturé à l'usage réseau.

### 11.2 Méthode B — dans le conteneur de l'API

L'image de production contient le seed compilé (`dist/scripts/seed-demo.js`), exposé par
le script `seed:demo:prod`. Aucune ouverture réseau n'est nécessaire.

```bash
npm i -g @railway/cli
railway login
railway link          # sélectionne le projet, l'environnement production
railway ssh --service api
```

Puis, dans le conteneur :

```sh
SEED_DEMO_RESET=1 SEED_ADMIN_PASSWORD='choisis-un-vrai-mot-de-passe' npm run seed:demo:prod
```

Le conteneur a déjà `MONGODB_URI` et `JWT_SECRET` dans son environnement : rien d'autre
à passer.

> `railway run` ne convient pas ici : il exécute la commande **sur ton poste** avec les
> variables du service injectées. Le `MONGODB_URI` du service pointe sur
> `*.railway.internal`, qui n'est résolvable que depuis le réseau privé Railway. La
> connexion échouerait avec `getaddrinfo ENOTFOUND`.

### 11.3 Mot de passe administrateur

Sans `SEED_ADMIN_PASSWORD`, le seed crée `admin@parisjanitor.fr` avec le mot de passe
`admin-1234`, et les comptes voyageurs de démonstration avec un mot de passe commun
documenté dans le README.

Ces identifiants sont publics dans le dépôt et le back-office est désormais accessible
depuis Internet. Renseigne `SEED_ADMIN_PASSWORD` au moment du seed, ou change le mot de
passe administrateur juste après.

---

## 12. Récapitulatif des variables

### Service `api`

| Variable | Valeur |
|---|---|
| `RAILWAY_DOCKERFILE_PATH` | `api/Dockerfile` |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `TRUST_PROXY` | `1` |
| `MONGODB_URI` | `mongodb://${{ MongoDB.MONGOUSER }}:${{ MongoDB.MONGOPASSWORD }}@${{ MongoDB.RAILWAY_PRIVATE_DOMAIN }}:27017/paris_janitor?authSource=admin` |
| `JWT_SECRET` | 32 octets aléatoires en hexadécimal |
| `JWT_EXPIRES_IN` | `7d` |
| `CORS_ORIGINS` | `https://${{ web-traveler.RAILWAY_PUBLIC_DOMAIN }},https://${{ web-admin.RAILWAY_PUBLIC_DOMAIN }}` |
| `APP_TRAVELER_URL` | `https://${{ web-traveler.RAILWAY_PUBLIC_DOMAIN }}` |
| `STRIPE_SECRET_KEY` | `sk_...` |
| `STRIPE_PUBLISHABLE_KEY` | `pk_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` de l'endpoint Railway |
| `STRIPE_PRICE_BAGPACKER_MONTHLY` | `price_...` |
| `STRIPE_PRICE_BAGPACKER_YEARLY` | `price_...` |
| `STRIPE_PRICE_EXPLORATOR_MONTHLY` | `price_...` |
| `STRIPE_PRICE_EXPLORATOR_YEARLY` | `price_...` |
| `STRIPE_RENEWAL_COUPON_ID` | `renewal-10` |

Réglages : Root Directory vide, Healthcheck Path `/api/health`, domaine public généré.

### Services `web-traveler` et `web-admin`

| Variable | `web-traveler` | `web-admin` |
|---|---|---|
| `RAILWAY_DOCKERFILE_PATH` | `web-traveler/Dockerfile` | `web-admin/Dockerfile` |
| `NGINX_TEMPLATE` | `nginx/spa-standalone.conf.template` | `nginx/spa-standalone.conf.template` |
| `VITE_API_URL` | `https://${{ api.RAILWAY_PUBLIC_DOMAIN }}/api` | `https://${{ api.RAILWAY_PUBLIC_DOMAIN }}/api` |
| `PORT` | `80` | `80` |

Réglages : Root Directory vide, domaine public généré.

### Service MongoDB

Aucune variable à ajouter. Accès public désactivé en régime normal.

---

## 13. Vérification de bout en bout

| # | Vérification | Attendu |
|---|---|---|
| 1 | `curl https://<api>/api/health` | `{"status":"ok","db":"connected"}` |
| 2 | `https://<api>/api/docs` | Swagger UI, sans authentification |
| 3 | Front voyageur, page d'accueil | Biens du seed affichés, pas de liste vide |
| 4 | Console du navigateur | Aucune erreur CORS, requêtes vers le domaine de l'API |
| 5 | Connexion voyageur | Session persistée au rechargement |
| 6 | Back-office, connexion admin | Tableau de bord chargé |
| 7 | Souscription VIP → Stripe Checkout | Retour sur `/account?checkout=success`, formule active dans `GET /api/me` |
| 8 | Réservation payée par carte `4242…` | Réservation `paid`, facture PDF téléchargeable |
| 9 | Webhooks Stripe, page de l'endpoint | Réponses `200` |
| 10 | Simulateur public, 30 requêtes | `429 RATE_LIMITED` déclenché |

Le point 7 est celui qui échoue le plus souvent : il dépend à la fois de
`APP_TRAVELER_URL`, du webhook et de `STRIPE_WEBHOOK_SECRET`.

---

## 14. Dépannage

### `"/package.json": not found` pendant le build

Le Root Directory du service a été mis à `api`, `web-traveler` ou `web-admin`. Le
contexte de build est alors ce sous-dossier, et le `COPY package.json` de la première
ligne ne trouve rien.

**Settings → Source → Root Directory** → vider le champ. Voir section 1.

### Le build ignore le Dockerfile et parle de Railpack ou Nixpacks

`RAILWAY_DOCKERFILE_PATH` est absente, mal orthographiée, ou pointe sur un chemin
inexistant. Railway retombe alors sur son constructeur automatique, qui ne sait pas quoi
faire de ce monorepo.

Vérifie la valeur exacte : `api/Dockerfile`, sans barre oblique initiale, avec un `D`
majuscule. Les journaux d'un build correct affichent `Using detected Dockerfile!`.

### `host not found in upstream "api"` — un front ne démarre pas

`NGINX_TEMPLATE` est absente sur le service front : l'image a pris son template par
défaut, celui de Docker Compose, qui proxyfie `/api/` vers un hôte `api` inexistant sur
Railway. nginx refuse de charger une configuration dont un upstream ne se résout pas.

Ajoute `NGINX_TEMPLATE=nginx/spa-standalone.conf.template` et redéploie.

### « Application failed to respond » sur un domaine

Le proxy Railway n'atteint pas le conteneur. Dans l'ordre :

1. **Settings → Networking** : le **Target Port** correspond-il au port réel ?
   `3000` pour l'API, `80` pour les fronts.
2. La variable `PORT` du service correspond-elle à ce port ?
3. Le déploiement est-il réellement démarré ? Onglet **Deployments** → **View Logs**.

### `MongoServerError: Authentication failed`

Il manque `?authSource=admin` à la fin de `MONGODB_URI`. L'utilisateur généré par
Railway existe dans la base `admin`, pas dans `paris_janitor`.

### `/api/health` répond avec `db` différent de `connected`

- Nom du service MongoDB mal orthographié dans la référence `${{ ... }}` : compare avec
  le nom affiché sur le canvas, la casse compte.
- `RAILWAY_PRIVATE_DOMAIN` référencé sur le mauvais service.
- Port autre que `27017` dans l'URL privée.

Ouvre le service MongoDB → **Variables** → révèle `MONGO_URL` et compare hôte et port
avec ce que tu as composé.

### `Configuration invalide, démarrage annulé` dans les journaux

C'est la validation Zod de `api/src/config/env.ts`. Le message qui suit nomme la
variable fautive. Les causes les plus fréquentes : `JWT_SECRET` de moins de 16
caractères, ou `APP_TRAVELER_URL` qui n'est pas une URL absolue valide (il lui faut le
`https://`).

### Le front appelle `http://localhost:3000/api`

`VITE_API_URL` n'était pas disponible **au moment du build** : le bundle est retombé sur
la valeur par défaut du code. Soit la variable a été ajoutée après le build, soit la
référence `${{ api.RAILWAY_PUBLIC_DOMAIN }}` s'est résolue à vide parce que l'API
n'avait pas encore de domaine public.

Génère le domaine de l'API, vérifie la variable, puis **Redeploy** le front — un restart
ne suffit pas, il faut reconstruire l'image.

Pour confirmer ce qui a été compilé, ouvre l'onglet Réseau du navigateur et regarde la
cible réelle des requêtes.

### `blocked by CORS policy` dans la console

L'origine du navigateur ne figure pas à l'identique dans `CORS_ORIGINS`. Compare
caractère par caractère avec la barre d'adresse : pas de barre oblique finale, pas de
chemin, `https://` inclus, et les entrées séparées par des virgules sans espace.

Après correction, l'API doit être redéployée pour relire la variable.

### Stripe : `Webhook signature verification failed`, réponses 400

`STRIPE_WEBHOOK_SECRET` ne correspond pas à l'endpoint qui envoie les événements. Le
secret affiché par `stripe listen` en local n'est pas celui de l'endpoint déclaré dans
le Dashboard. Reprends la valeur sur la page de l'endpoint Railway, section **Clé
secrète de signature**.

### Stripe : réponses 503 `STRIPE_NOT_CONFIGURED`

`STRIPE_SECRET_KEY` est vide sur le service `api`, ou un identifiant de prix manque pour
la formule demandée. Les huit variables `STRIPE_*` doivent être renseignées.

### Le simulateur renvoie `429` à tout le monde

`TRUST_PROXY` n'est pas positionné à `1`. Sans cela, Express voit l'adresse du proxy
Railway pour toutes les requêtes, et la limite par IP devient une limite globale.

### Un correctif poussé sur GitHub ne change rien

Les **Watch Paths** du service excluent le fichier modifié (section 8.4). Vérifie dans
**Settings → Build**, ou déclenche un **Redeploy** manuel.

### Le catalogue de prestations renvoie une erreur 500

Les barèmes de commission ne sont pas en base : le seed n'a pas été exécuté, ou il a
échoué en cours. Relance-le avec `SEED_DEMO_RESET=1` (section 11).

---

## 15. Après le déploiement

**Domaine personnalisé.** **Settings → Networking → Custom Domain**, puis les
enregistrements `CNAME` et `TXT` chez ton registrar. Les deux sont exigés. Si tu changes
le domaine de l'API, reconstruis les deux fronts et mets à jour l'URL de l'endpoint
Stripe.

**Journaux.** Service → onglet **Deployments** → **View Logs**. Les erreurs applicatives
y apparaissent au format `{ error: { code, message } }` du gestionnaire d'erreurs.

**Sauvegarde.** Toute la donnée, GridFS compris, vit dans le volume du service MongoDB.
Pour un export avant soutenance, réactive l'accès public le temps d'un `mongodump` sur
`MONGO_PUBLIC_URL`, puis désactive-le.

**Différences avec la procédure VPS.** [`deploiement.md`](deploiement.md) reste valable
pour un déploiement Docker Compose sur Ubuntu : nginx y garde son proxy `/api/`, les
fronts sont construits avec `VITE_API_URL=/api`, et MongoDB tourne avec un utilisateur
applicatif dédié. Les deux procédures sont indépendantes et le dépôt supporte les deux
sans modification.
