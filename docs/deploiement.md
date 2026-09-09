# Déploiement sur un VPS Ubuntu 24.04

Procédure complète pour mettre Paris Janitor en production sur un serveur neuf. Comptez une heure la première fois, dont l'essentiel en attente des DNS.

Les domaines d'exemple sont `voyageurs.exemple.fr` et `admin.exemple.fr`. Remplacez-les partout par les vôtres.

## Sommaire

1. [Architecture cible](#1-architecture-cible)
2. [Prérequis](#2-prérequis)
3. [Préparer le serveur](#3-préparer-le-serveur)
4. [Installer Docker](#4-installer-docker)
5. [Cloner le projet](#5-cloner-le-projet)
6. [Variables d'environnement](#6-variables-denvironnement)
7. [Adapter le compose au double proxy](#7-adapter-le-compose-au-double-proxy)
8. [Premier démarrage](#8-premier-démarrage)
9. [Nginx et HTTPS Let's Encrypt](#9-nginx-et-https-lets-encrypt)
10. [Déclarer le webhook Stripe](#10-déclarer-le-webhook-stripe)
11. [Initialiser les données](#11-initialiser-les-données)
12. [Vérification finale](#12-vérification-finale)
13. [Exploitation courante](#13-exploitation-courante)
14. [Dépannage](#14-dépannage)

## 1. Architecture cible

```
                    ┌─────────────────────────── VPS Ubuntu 24.04 ───────────────────────────┐
                    │                                                                        │
  Internet          │   Nginx hôte (TLS Let's Encrypt)          Docker (paris-janitor-prod)  │
  ────────►  :443 ──┼──► voyageurs.exemple.fr ──► 127.0.0.1:8080 ──► web-traveler (nginx)    │
                    │                                                    │ /api/             │
                    │                                                    ▼                   │
             :443 ──┼──► admin.exemple.fr ──────► 127.0.0.1:8081 ──► web-admin (nginx)       │
                    │                                                    │ /api/             │
                    │                                                    ▼                   │
                    │                                                  api:3000              │
                    │                                                    │                   │
                    │                                                  mongo:27017           │
                    │                                              (volume mongo-data)       │
                    └────────────────────────────────────────────────────────────────────────┘
```

Points structurants :

- **Seuls les ports 80 et 443 sont ouverts.** Les trois conteneurs applicatifs sont publiés sur `127.0.0.1` uniquement, inaccessibles depuis l'extérieur.
- **Chaque front embarque son propre Nginx** qui sert l'application et relaie `/api/` vers le conteneur `api`. Les appels sont donc de même origine : aucun préflight CORS en production.
- **MongoDB ne publie aucun port.** Il n'est joignable que depuis le réseau Docker interne.
- **Les fronts sont construits avec `VITE_API_URL=/api`**, une URL relative. Changer de nom de domaine plus tard ne demande **aucune reconstruction** des images de front.
- **Le webhook Stripe passe par le domaine voyageur** : `https://voyageurs.exemple.fr/api/stripe/webhook`, relayé jusqu'à l'API. Il n'est donc pas nécessaire d'exposer l'API directement.

## 2. Prérequis

- Un VPS Ubuntu 24.04 LTS, 2 Go de RAM au minimum (la construction des images en consomme davantage que l'exécution), 20 Go de disque.
- Un accès `root` ou un compte `sudo`.
- Deux enregistrements DNS de type `A` pointant vers l'IP du VPS :

  | Nom | Type | Valeur |
  |---|---|---|
  | `voyageurs.exemple.fr` | A | `203.0.113.10` |
  | `admin.exemple.fr` | A | `203.0.113.10` |

  Créez-les **avant** de commencer : Let's Encrypt vérifie la résolution DNS, et la propagation peut prendre de quelques minutes à plusieurs heures.

- Un compte Stripe avec, en mode live ou test selon votre cible :
  - quatre `Price` récurrents : Bag Packer 9,90 €/mois et 113 €/an, Explorator 19 €/mois et 220 €/an ;
  - un coupon `percent_off: 10` pour le bonus de renouvellement ;
  - le portail client activé dans **Paramètres → Billing → Customer portal**, avec changement de formule sur les quatre prix et résiliation en fin de période.

## 3. Préparer le serveur

Connectez-vous en `root`, mettez le système à jour et installez les outils de base :

```bash
apt update && apt upgrade -y
apt install -y ca-certificates curl git ufw rsync
```

Créez ensuite un utilisateur de service et reportez-lui votre clé SSH. Faire tourner le déploiement sous `root` n'apporte rien et complique la suite.

```bash
adduser --gecos "" deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy/
```

Posez le pare-feu, toujours en `root` :

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

Reconnectez-vous en tant que `deploy` pour la suite de la procédure. Vérifiez avant de fermer la session `root` que la connexion fonctionne, sous peine de vous verrouiller dehors.

N'ouvrez **jamais** 3000, 8080 ni 8081 : ces ports seront liés à la boucle locale et doivent le rester.

Vérifiez au passage que le fuseau et l'heure sont corrects, la vérification de signature des webhooks Stripe tolère mal une horloge décalée :

```bash
timedatectl set-timezone Europe/Paris
timedatectl
```

## 4. Installer Docker

Utilisez le dépôt officiel Docker, pas le paquet `docker.io` d'Ubuntu qui est ancien et ne fournit pas `docker compose` v2.

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Autorisez `deploy` à piloter Docker sans `sudo`, puis ouvrez une nouvelle session pour que le groupe soit pris en compte :

```bash
sudo usermod -aG docker deploy
newgrp docker
docker compose version
```

La dernière commande doit afficher une version `v2.x`.

## 5. Cloner le projet

```bash
sudo mkdir -p /opt/paris-janitor
sudo chown deploy:deploy /opt/paris-janitor
git clone https://github.com/Jsuitonper/paris-janitor.git /opt/paris-janitor
cd /opt/paris-janitor
```

Si le dépôt est privé, générez une clé de déploiement sur le VPS et ajoutez-la en lecture seule dans les paramètres du dépôt GitHub :

```bash
ssh-keygen -t ed25519 -C "deploy@paris-janitor" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

## 6. Variables d'environnement

Partez du modèle fourni :

```bash
cd /opt/paris-janitor
cp .env.production.example .env.production
chmod 600 .env.production
```

Générez les secrets. **Utilisez des valeurs hexadécimales** : elles ne contiennent aucun caractère à encoder dans l'URL de connexion MongoDB, ce qui évite une classe entière de pannes.

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "MONGO_ROOT_PASSWORD=$(openssl rand -hex 16)"
echo "MONGO_APP_PASSWORD=$(openssl rand -hex 16)"
```

Éditez `.env.production` avec `nano .env.production` et complétez :

```ini
# MongoDB — root ne sert qu'à l'initialisation du conteneur
MONGO_ROOT_USERNAME=root
MONGO_ROOT_PASSWORD=<hex généré>
MONGO_APP_DATABASE=paris_janitor
MONGO_APP_USERNAME=paris_janitor_app
MONGO_APP_PASSWORD=<hex généré>

# API
NODE_ENV=production
PORT=3000
TRUST_PROXY=2
MONGODB_URI=mongodb://paris_janitor_app:<MONGO_APP_PASSWORD>@mongo:27017/paris_janitor?authSource=paris_janitor
JWT_SECRET=<hex généré>
JWT_EXPIRES_IN=7d
CORS_ORIGINS=https://voyageurs.exemple.fr,https://admin.exemple.fr
APP_TRAVELER_URL=https://voyageurs.exemple.fr

# Stripe
STRIPE_SECRET_KEY=sk_live_…
STRIPE_PUBLISHABLE_KEY=pk_live_…
STRIPE_WEBHOOK_SECRET=            # laissé vide pour l'instant, rempli à l'étape 10
STRIPE_PRICE_BAGPACKER_MONTHLY=price_…
STRIPE_PRICE_BAGPACKER_YEARLY=price_…
STRIPE_PRICE_EXPLORATOR_MONTHLY=price_…
STRIPE_PRICE_EXPLORATOR_YEARLY=price_…
STRIPE_RENEWAL_COUPON_ID=renewal-10

# Publication des ports : boucle locale uniquement
API_PORT=127.0.0.1:3000
TRAVELER_PORT=127.0.0.1:8080
ADMIN_PORT=127.0.0.1:8081
```

Trois pièges à connaître :

- **`MONGO_APP_PASSWORD` doit apparaître à l'identique dans `MONGODB_URI`.** C'est la source d'erreur la plus fréquente au premier démarrage.
- **`authSource=paris_janitor`** et non `admin` : l'utilisateur applicatif est créé dans la base métier, pas dans la base d'administration.
- **`.env.production` n'est jamais commité** : il figure dans le `.gitignore`. Sauvegardez-le ailleurs, hors du dépôt.

## 7. Adapter le compose au double proxy

Le fichier `docker-compose.prod.yml` fixe `TRUST_PROXY: 1` dans son bloc `environment`, qui **écrase** la valeur du fichier `.env.production`. Or dans cette architecture il y a deux relais successifs, le Nginx de l'hôte puis celui du conteneur de front. Avec la valeur 1, Express considère l'adresse du Nginx hôte comme celle du client : la limitation de débit du simulateur public compterait alors toutes les visites sur une seule et même IP, et bloquerait tout le monde après vingt simulations.

Rendez la variable pilotable depuis l'environnement :

```bash
cd /opt/paris-janitor
sed -i 's/      TRUST_PROXY: 1/      TRUST_PROXY: ${TRUST_PROXY:-1}/' docker-compose.prod.yml
grep -n "TRUST_PROXY" docker-compose.prod.yml
```

La sortie doit montrer `TRUST_PROXY: ${TRUST_PROXY:-1}`. Combinée à `TRUST_PROXY=2` dans `.env.production`, l'API retrouve la véritable adresse du visiteur.

> Si vous placez plus tard un CDN ou un répartiteur de charge devant le VPS, incrémentez encore : la valeur correspond au nombre de relais de confiance entre le client et l'application.

## 8. Premier démarrage

Construisez les images et lancez la pile. La première construction dure plusieurs minutes.

```bash
cd /opt/paris-janitor
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Contrôlez l'état :

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

Les quatre conteneurs doivent être `Up`, et `paris-janitor-mongo-prod` marqué `healthy`. Si `paris-janitor-api` est en `Restarting`, allez directement au [dépannage](#lapi-redémarre-en-boucle-avec-authentication-failed).

Vérifiez l'API depuis le serveur :

```bash
curl -s http://127.0.0.1:3000/api/health
```

Attendu : `{"status":"ok","db":"connected"}`.

Vérifiez que le relais interne des fronts fonctionne :

```bash
curl -s http://127.0.0.1:8080/api/health
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/
```

## 9. Nginx et HTTPS Let's Encrypt

Installez Nginx et Certbot :

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Créez le site du front voyageur :

```bash
sudo nano /etc/nginx/sites-available/paris-janitor
```

Contenu :

```nginx
server {
    listen 80;
    server_name voyageurs.exemple.fr;

    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}

server {
    listen 80;
    server_name admin.exemple.fr;

    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

`client_max_body_size 12m` est indispensable : sans lui, Nginx rejette en 413 les envois de photos et de pièces jointes avant même d'atteindre l'application, dont le plafond est de 10 Mo.

Activez le site et rechargez :

```bash
sudo ln -sf /etc/nginx/sites-available/paris-janitor /etc/nginx/sites-enabled/paris-janitor
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Avant d'aller plus loin, vérifiez que les domaines résolvent bien vers le VPS :

```bash
dig +short voyageurs.exemple.fr
dig +short admin.exemple.fr
```

Obtenez les certificats. Certbot modifie lui-même la configuration Nginx pour ajouter les blocs TLS et la redirection HTTP vers HTTPS :

```bash
sudo certbot --nginx -d voyageurs.exemple.fr -d admin.exemple.fr --agree-tos -m vous@exemple.fr --redirect
```

Le renouvellement automatique est installé par le paquet sous forme de minuterie systemd. Confirmez-le :

```bash
systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

Testez enfin les deux domaines depuis l'extérieur :

```bash
curl -s https://voyageurs.exemple.fr/api/health
curl -s -o /dev/null -w "%{http_code}\n" https://admin.exemple.fr/
```

## 10. Déclarer le webhook Stripe

Les webhooks sont **l'unique source de vérité** de l'état d'abonnement et du statut de paiement dans cette application. Sans eux, un paiement réussi ne passera jamais une réservation en « payée » et aucun abonnement ne s'activera. Cette étape n'est pas optionnelle.

Dans le Dashboard Stripe, allez dans **Développeurs → Webhooks → Ajouter un endpoint** :

- **URL** : `https://voyageurs.exemple.fr/api/stripe/webhook`
- **Événements à envoyer** :

  | Événement | Effet dans l'application |
  |---|---|
  | `checkout.session.completed` | rattache le client Stripe au compte |
  | `customer.subscription.created` | active la formule, pose la date d'ancrage du quota |
  | `customer.subscription.updated` | changement de formule, de cycle, résiliation programmée |
  | `customer.subscription.deleted` | retour en Free |
  | `invoice.paid` | réactive après impayé, applique le bonus de renouvellement |
  | `invoice.payment_failed` | suspend les avantages |
  | `payment_intent.succeeded` | passe la réservation en payée et émet la facture |
  | `payment_intent.payment_failed` | passe en échec, restitue le quota VIP |
  | `payment_intent.canceled` | idem, avec le motif « Paiement annulé » |

Récupérez le **secret de signature** affiché sur la fiche de l'endpoint, de la forme `whsec_…`.

> Ce secret n'a **rien à voir** avec celui qu'affiche `stripe listen` en développement. Celui du CLI est éphémère et propre à votre session locale. Utiliser le mauvais donne un `400 INVALID_SIGNATURE` sur chaque événement.

Reportez-le dans `.env.production`, puis redémarrez l'API — le conteneur ne relit pas le fichier à chaud :

```bash
cd /opt/paris-janitor
nano .env.production          # renseigner STRIPE_WEBHOOK_SECRET
docker compose -f docker-compose.prod.yml --env-file .env.production up -d api
```

Déclenchez ensuite un événement de test depuis le Dashboard, bouton **Envoyer un événement de test** sur la fiche de l'endpoint. Stripe doit afficher une réponse `200` et le corps `{"received":true,"duplicate":false,"handled":…}`.

## 11. Initialiser les données

Les scripts sont exécutés **depuis le conteneur**, en JavaScript compilé : l'image de production ne contient pas `tsx`.

La configuration tarifaire est **obligatoire**. Sans elle, le catalogue des prestations renvoie une erreur 500 que le front présente comme un catalogue vide, ce qui est difficile à diagnostiquer.

```bash
cd /opt/paris-janitor
docker compose -f docker-compose.prod.yml --env-file .env.production exec api node dist/scripts/seed-pricing.js
```

Sortie attendue : le barème à 5 paliers, les 3 formules VIP, les 5 options du simulateur.

Créez le compte administrateur en choisissant vos identifiants :

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec \
  -e SEED_ADMIN_EMAIL=admin@exemple.fr \
  -e SEED_ADMIN_PASSWORD='<mot de passe fort>' \
  api node dist/scripts/seed-admin.js
```

**Pour une soutenance ou une démonstration seulement**, le jeu complet remplace tout le contenu :

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec \
  -e SEED_DEMO_RESET=1 \
  api node dist/scripts/seed-demo.js
```

> `seed-demo` **vide toutes les collections métier** avant d'écrire. Ne l'exécutez jamais sur une base contenant de vraies données. Sans `SEED_DEMO_RESET=1`, il refuse de s'exécuter si des données existent, ce qui est le garde-fou.

## 12. Vérification finale

Déroulez cette liste avant d'annoncer la mise en ligne.

| Contrôle | Commande ou geste | Attendu |
|---|---|---|
| API vivante | `curl -s https://voyageurs.exemple.fr/api/health` | `{"status":"ok","db":"connected"}` |
| Catalogue des prestations | `curl -s https://voyageurs.exemple.fr/api/catalog/offerings` | un tableau JSON, **pas** une erreur 500 |
| Formules VIP | `curl -s https://voyageurs.exemple.fr/api/catalog/vip-plans` | trois formules |
| Front voyageur | ouvrir `https://voyageurs.exemple.fr` | page Logements, cadenas TLS |
| Route profonde | ouvrir `https://voyageurs.exemple.fr/simulateur` puis rafraîchir | la page se recharge, pas de 404 |
| Back-office | ouvrir `https://admin.exemple.fr` et se connecter | tableau des utilisateurs |
| Redirection HTTP | `curl -sI http://voyageurs.exemple.fr` | `301` vers `https://` |
| En-têtes de sécurité | `curl -sI https://voyageurs.exemple.fr \| grep -i x-frame` | `X-Frame-Options: DENY` |
| Webhook Stripe | événement de test depuis le Dashboard | `200`, `received: true` |
| Paiement complet | réserver puis payer avec `4242 4242 4242 4242` | réservation « payée », facture PDF téléchargeable |
| IP réelle vue par l'API | 25 simulations en rafale depuis un poste | les 20 premières passent, les suivantes en 429 ; les autres visiteurs ne sont pas bloqués |
| Ports fermés | `sudo ss -tlnp \| grep -E '8080\|8081\|3000'` | uniquement des liaisons `127.0.0.1` |

## 13. Exploitation courante

### Mettre à jour l'application

```bash
cd /opt/paris-janitor
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker image prune -f
```

Les données survivent : elles vivent dans le volume `paris-janitor-prod_mongo-data` et dans GridFS, jamais dans les images.

### Consulter les journaux

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f api
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail 100 mongo
sudo tail -f /var/log/nginx/error.log
```

### Sauvegarder la base

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T mongo \
  mongodump --archive --gzip \
  --username="$(grep '^MONGO_APP_USERNAME=' .env.production | cut -d= -f2)" \
  --password="$(grep '^MONGO_APP_PASSWORD=' .env.production | cut -d= -f2)" \
  --authenticationDatabase=paris_janitor \
  --db=paris_janitor > "sauvegarde-$(date +%F).gz"
```

La sauvegarde inclut GridFS, donc les factures PDF et les photos. Copiez-la hors du VPS, et planifiez-la dans une tâche `cron`.

### Restaurer

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T mongo \
  mongorestore --archive --gzip --drop \
  --username="$(grep '^MONGO_APP_USERNAME=' .env.production | cut -d= -f2)" \
  --password="$(grep '^MONGO_APP_PASSWORD=' .env.production | cut -d= -f2)" \
  --authenticationDatabase=paris_janitor < sauvegarde-2026-09-08.gz
```

### Arrêter sans perdre les données

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production down
```

`down` seul conserve le volume. **N'ajoutez jamais `-v`** sur un serveur de production : cette option détruit la base.

## 14. Dépannage

### L'API redémarre en boucle avec `Authentication failed`

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production logs api | grep -i auth
```

Trois causes, par ordre de fréquence :

1. **`MONGO_APP_PASSWORD` et le mot de passe dans `MONGODB_URI` diffèrent.** Comparez les deux lignes caractère par caractère.
2. **`authSource` est incorrect.** L'URL doit se terminer par `?authSource=paris_janitor`, pas `admin`.
3. **Le volume existait déjà** avec d'autres identifiants. Le script `mongo/init-app-user.js` ne s'exécute qu'au tout premier démarrage, sur un répertoire de données vide. Si vous avez changé les mots de passe après un premier lancement, l'utilisateur applicatif porte encore l'ancien.

Pour le troisième cas, sur une base **sans données à conserver** :

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production down -v
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Si la base contient des données, ne détruisez rien : changez plutôt le mot de passe de l'utilisateur existant.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec mongo \
  mongosh --quiet -u root -p "$(grep '^MONGO_ROOT_PASSWORD=' .env.production | cut -d= -f2)" \
  --authenticationDatabase admin paris_janitor \
  --eval 'db.changeUserPassword("paris_janitor_app", "<nouveau mot de passe>")'
```

### `error while interpolating services.mongo.environment: required variable MONGO_ROOT_USERNAME is missing`

Le compose déclare plusieurs variables obligatoires avec la syntaxe `:?`. Vous avez oublié `--env-file .env.production`, ou la variable manque dans le fichier. Toutes les commandes `docker compose -f docker-compose.prod.yml` doivent porter `--env-file .env.production`.

### La pile de production démarre sur les données de développement

Symptôme : des biens ou des comptes de démonstration apparaissent alors que la base devrait être vierge.

Docker Compose déduit le nom de projet du dossier lorsqu'il n'est pas déclaré, et les deux piles partagent alors le même volume. Les deux fichiers du dépôt portent désormais un nom explicite, `paris-janitor-dev` et `paris-janitor-prod`. Vérifiez qu'ils sont bien présents :

```bash
head -1 docker-compose.yml docker-compose.prod.yml
docker volume ls | grep janitor
```

Vous devez voir deux volumes distincts. N'exécutez jamais les deux piles sur le même serveur sans cette séparation.

### Le catalogue des prestations est vide alors que des prestations existent

Le symptôme trompe : le front affiche une liste vide, mais l'API renvoie en réalité une erreur.

```bash
curl -s https://voyageurs.exemple.fr/api/catalog/offerings
```

Si la réponse est `{"error":{"code":"VIP_PLAN_MISSING",…}}`, la configuration tarifaire n'a pas été initialisée. Le front avale l'erreur et affiche un tableau vide, d'où la confusion.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec api node dist/scripts/seed-pricing.js
```

Le catalogue des **biens** ne dépend pas de cette configuration : s'il fonctionne pendant que les prestations sont vides, c'est presque toujours cette cause.

### Stripe renvoie `400 INVALID_SIGNATURE` sur chaque événement

1. **Mauvais secret.** Celui du Dashboard, pas celui de `stripe listen`. Un endpoint recréé produit un nouveau secret.
2. **API non redémarrée** après modification de `.env.production`. Relancez `up -d api`.
3. **Horloge du serveur décalée.** Stripe rejette les signatures hors fenêtre de tolérance. Vérifiez avec `timedatectl`.

Vérifiez la valeur réellement chargée par le conteneur, sans la révéler :

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec api \
  sh -c 'echo "longueur: ${#STRIPE_WEBHOOK_SECRET}, préfixe: $(echo $STRIPE_WEBHOOK_SECRET | cut -c1-6)"'
```

### Un paiement réussit chez Stripe mais la réservation reste « à payer »

C'est le symptôme d'un webhook qui n'arrive pas. Le retour du navigateur ne valide **jamais** un paiement, par conception.

Ouvrez la fiche de l'endpoint dans le Dashboard et regardez les tentatives récentes. Codes usuels :

- **`404`** : l'URL est fausse. Elle doit être `/api/stripe/webhook`, sur le domaine voyageur.
- **`400`** : signature invalide, voir ci-dessus.
- **délai dépassé** : l'API ne répond pas, vérifiez `docker compose ps`.

Stripe réessaie automatiquement pendant plusieurs jours : une fois la cause corrigée, utilisez le bouton de renvoi sur les événements en échec, ils seront traités normalement. Le rejeu est sans danger, l'application ignore un `event.id` déjà traité.

### `502 Bad Gateway` sur un des domaines

Le Nginx de l'hôte ne joint pas le conteneur.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
sudo ss -tlnp | grep -E '8080|8081'
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/
```

Si aucune liaison n'apparaît, `TRAVELER_PORT` ou `ADMIN_PORT` est mal formé dans `.env.production` : la valeur attendue est `127.0.0.1:8080`, pas seulement `8080` si vous voulez la restriction à la boucle locale.

### Certbot échoue avec `Timeout during connect` ou `NXDOMAIN`

1. Le DNS ne pointe pas encore vers le VPS : `dig +short voyageurs.exemple.fr` doit renvoyer l'IP du serveur.
2. Le port 80 est fermé : `sudo ufw status` doit lister `80/tcp ALLOW`.
3. Un autre service occupe le port 80 : `sudo ss -tlnp | grep :80`.

Certbot a besoin du port 80 même pour délivrer un certificat destiné au 443 : ne le fermez pas après coup, le renouvellement en dépend.

### Tous les visiteurs sont bloqués en `429` sur le simulateur

La limitation compte par adresse IP. Si l'API voit l'adresse du proxy au lieu de celle du visiteur, un seul compteur est partagé par tout le monde.

```bash
grep -n "TRUST_PROXY" docker-compose.prod.yml .env.production
docker compose -f docker-compose.prod.yml --env-file .env.production exec api sh -c 'echo $TRUST_PROXY'
```

La valeur effective doit être `2` avec l'architecture décrite ici. Si le conteneur affiche `1`, l'étape 7 n'a pas été appliquée : le bloc `environment` du compose écrase le fichier d'environnement.

### `413 Request Entity Too Large` à l'envoi d'une photo

Trois plafonds se cumulent, du plus extérieur au plus intérieur :

| Niveau | Réglage | Valeur |
|---|---|---|
| Nginx hôte | `client_max_body_size` | 12 Mo, à poser vous-même, défaut 1 Mo |
| Nginx du conteneur | `nginx/spa.conf.template` | 12 Mo, déjà configuré |
| Application | `MAX_FILE_BYTES` | 10 Mo |

Un 413 avec un fichier de moins de 10 Mo vient presque toujours du Nginx de l'hôte, oublié à l'étape 9.

### La construction des images échoue par manque de mémoire

Le build Vite est le plus gourmand. Sur un VPS à 2 Go, ajoutez un fichier d'échange :

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Vous pouvez aussi construire les images ailleurs et les pousser vers un registre, plutôt que de compiler sur le serveur.

### Le disque se remplit

Les anciennes couches d'images s'accumulent à chaque déploiement.

```bash
docker system df
docker image prune -af
docker builder prune -af
```

Ne lancez jamais `docker system prune --volumes` : cette commande emporte le volume de la base.

### Après changement de domaine, faut-il reconstruire ?

Non pour les fronts : ils appellent l'API sur l'URL relative `/api`, indépendante du domaine. Il faut en revanche mettre à jour `CORS_ORIGINS` et surtout **`APP_TRAVELER_URL`**, qui sert à construire les URL de retour de Stripe Checkout, puis redémarrer l'API et refaire les certificats pour les nouveaux noms.
