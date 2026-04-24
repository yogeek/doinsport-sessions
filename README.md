# Doinsport Sessions — Démo PWA

Petite application **PWA React** qui consomme l'API externe Doinsport pour afficher
les créneaux de terrains libres sur une période donnée. Objectif : démontrer la
faisabilité d'une app d'organisation de sessions padel (8 ou 12 joueurs selon le
nombre de terrains disponibles en parallèle).

## Fonctionnalités

- 🔐 Authentification JWT avec un compte UserClient Doinsport
- 🎾 Chargement automatique des terrains actifs du club
- 🗓️ Recherche de créneaux sur une plage de dates et d'horaires
- 👥 Filtre par taille de session : 1 terrain (4j), 2 terrains (8j), 3 terrains (12j)
- 📱 Installable en PWA (iOS / Android / desktop)
- 🐳 Déployable sur Cloud Run (ou n'importe quelle plateforme Docker)

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS (palette custom : forest green + cream + terracotta)
- `vite-plugin-pwa` pour le service worker et le manifest
- date-fns + lucide-react
- Serveur runtime : Nginx Alpine

## Lancer en local

```bash
npm install
npm run dev
# ouvrir http://localhost:5173
```

## Déploiement sur GitHub Pages

### 1. Créer et pousser le repo

```bash
cd doinsport-sessions

git init
git add .
git commit -m "init: PWA Doinsport"

git branch -M main
git remote add origin https://github.com/VOTRE_USERNAME/doinsport-sessions.git
git push -u origin main
```

### 2. Activer GitHub Pages

- Va sur **Settings** → **Pages**
- Source : **Deploy from a branch**
- Branch : **gh-pages**, dossier : **/ (root)**
- Clique **Save**

Le workflow GitHub Actions build automatiquement et déploie chaque push vers la branche `gh-pages`.
L'app sera accessible à : `https://VOTRE_USERNAME.github.io/doinsport-sessions/`

### 3. Test CORS préalable (important ⚠️)

Avant de pousser sur GitHub Pages, **teste d'abord en local** :

```bash
npm install && npm run dev
# Ouvrir http://localhost:5173
# Essayer de te logger
```

Si le login marche → CORS devrait passer sur GitHub Pages.
Si le login échoue avec une erreur réseau CORS → utilise Cloud Run (voir ci-dessous).

## Configuration utilisateur

Au login, saisis simplement :
- `email` + `mot de passe` d'un compte Doinsport (UserClient ou UserClub)

L'`URL de base` (par défaut `https://api-principale.doinsport.club`) et le `Club ID`
sont accessibles via le bouton **Configuration** mais sont **optionnels** :

- Si tu ne fournis pas de `Club ID`, l'app liste tous les terrains accessibles à
  ton compte. Si plusieurs clubs sont détectés, un sélecteur s'affiche. Si un
  seul → sélection auto.
- Tu peux forcer un `Club ID` si tu veux cibler un club précis dès le départ.

## Variables d'environnement (optionnel)

Pour pré-remplir la config au build (utile si tu veux figer la cible) :

```bash
# .env.local
VITE_DOINSPORT_BASE_URL=https://api-principale.doinsport.club
VITE_DOINSPORT_CLUB_ID=abc123...      # optionnel
```

## Déploiement Cloud Run (si CORS bloqué sur GitHub Pages)

Si le test local montre que CORS bloque l'API Doinsport, tu as deux options :

**Option A (recommandée pour une démo)** : Utiliser Cloud Run avec un proxy CORS en Nginx
(déjà intégré au Dockerfile). Cloud Run servira à la fois le frontend et fera du reverse proxy.

**Option B** : Modifier l'app pour appeler une API gateway custom (Cloudflare Worker, etc.)

Voici l'Option A :

### Build local Docker

```bash
docker build -t doinsport-sessions .
docker run --rm -p 8080:8080 doinsport-sessions
# ouvrir http://localhost:8080
```

Avec des args de build pour figer la config :

```bash
docker build \
  --build-arg VITE_DOINSPORT_BASE_URL=https://api-principale.doinsport.club \
  --build-arg VITE_DOINSPORT_CLUB_ID=abc123 \
  -t doinsport-sessions .
```

## Déploiement Cloud Run

**Option 1 : depuis le source (le plus simple)**

```bash
gcloud run deploy doinsport-sessions \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 8080
```

Cloud Run détecte le Dockerfile, build l'image avec Cloud Build et déploie.

**Option 2 : avec Artifact Registry**

```bash
# 1. Build + push
gcloud builds submit --tag europe-west1-docker.pkg.dev/PROJECT_ID/apps/doinsport-sessions

# 2. Deploy
gcloud run deploy doinsport-sessions \
  --image europe-west1-docker.pkg.dev/PROJECT_ID/apps/doinsport-sessions \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 8080
```

**Pour figer la config au build Cloud Run**, crée un `cloudbuild.yaml` ou passe
`--build-arg` via `gcloud builds submit --config`. Sinon laisse les utilisateurs
configurer via l'écran de login (plus flexible pour une démo).

## Architecture

```
src/
├── api/doinsport.ts       # Client HTTP : login, playgrounds, slots
├── context/AuthContext.tsx # Token JWT + localStorage
├── screens/
│   ├── LoginScreen.tsx     # Écran d'accueil + config
│   └── SearchScreen.tsx    # Filtres + résultats
├── utils/
│   ├── date.ts             # Helpers dates en français
│   └── slots.ts            # Agrégation multi-terrains (logique métier)
└── types.ts                # Types API Doinsport
```

### Logique d'agrégation

Pour chaque combinaison `(terrain × jour)` sur la période choisie, l'app fait
un `GET /clubs/playgrounds/{id}/slots` (max 4 requêtes parallèles pour respecter
le rate limit). Les résultats sont regroupés par `(date, heure de début)` :
chaque créneau unifié indique **combien** et **quels** terrains sont libres
simultanément. On ne garde que les créneaux où le nombre de courts libres ≥ au
seuil choisi.

Un créneau est considéré libre si :
- `participantsCount < maxParticipantsCountLimit`
- `bookingsCount < maxBookingsCountLimit` (utile pour les terrains en mode `unique`)

### Détection automatique des clubs

L'app n'exige pas le `club.id` : au login, elle appelle
`GET /clubs/playgrounds?enabled=true` (sans filtre club) et déduit la liste des
clubs distincts à partir du champ `club` de chaque playground (qui peut être un
IRI string `/clubs/abc123` ou un objet hydraté selon la sérialisation). Trois cas :

- **0 club détecté** (champ absent dans la réponse) → on traite tous les
  terrains comme un seul club implicite
- **1 seul club** → sélection automatique, on continue directement
- **Plusieurs clubs** → un sélecteur s'affiche en haut de l'écran principal

## Points d'attention

### GitHub Pages vs Cloud Run : le dilemme CORS

**GitHub Pages** : gratuit, pas de maintenance, mais risque de **CORS bloqué**.

Doinsport peut avoir restreint l'API à certains domaines. Si tu pushes sur GitHub Pages
et que le login échoue avec une erreur réseau CORS, tu devras utiliser Cloud Run.

**Test avant de choisir :**

```bash
npm run dev
# Essaie de te logger sur http://localhost:5173
```

Si ça marche → CORS devrait passer aussi sur GitHub Pages.
Si ça échoue → utilise Cloud Run + le Dockerfile existant (qui peut ajouter un proxy CORS).

### Configuration Doinsport

1. **URL de base** : la doc mentionne `api-principale.doinsport.club`
   en intro et `allin-api.doinsport.club` dans les exemples. À confirmer avec
   le support selon le tenant du club.
2. **Club ID** : optionnel. Si absent, l'app liste tous les terrains
   accessibles et affiche un sélecteur si plusieurs clubs sont détectés.
3. **CORS** : l'API étant prévue pour usage depuis un site vitrine, CORS devrait
   accepter les domaines externes. À tester en conditions réelles.
4. **Rate limit** : 50 requêtes/min sur certains endpoints. Le code limite à 4
   requêtes parallèles et 31 jours de période max.
5. **Stockage du token** : localStorage pour la démo. Pour une app prod,
   envisager `httpOnly cookie` via un backend.
6. **Refresh token** : non implémenté (JWT dure 1 an, on invalide au bout
   de 30 jours côté client). À ajouter pour une vraie app.

## Pour aller plus loin

- Ajouter la création de réservations (`POST /clubs/bookings`)
- Envoi automatique d'invitations (email / WhatsApp / SMS) → sortie du périmètre API Doinsport
- Vue semaine façon calendrier avec tous les slots
- Gestion multi-clubs
