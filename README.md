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

**Résultat :**
- ✅ Login marche → CORS est ouvert, GitHub Pages fonctionnera
- ❌ Erreur CORS → GitHub Pages ne fonctionnera pas, utilise Cloud Run (voir ci-dessous)

**Pourquoi CORS peut être bloqué ?**

L'app appelle directement l'API Doinsport depuis le navigateur. Si l'API a restreint 
les domaines autorisés (whitelist), `github.io` sera bloqué.

**Solution si CORS échoue : déployer sur Cloud Run**

Le Dockerfile inclut Nginx qui proxifie automatiquement les requêtes vers l'API Doinsport
avec les bons headers CORS. Tu n'as rien à changer — l'app détecte le contexte et utilise
le proxy automatiquement.

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

Si le test local montre que CORS bloque l'API Doinsport, déploie sur Cloud Run.

C'est aussi simple que GitHub Pages :

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

gcloud run deploy doinsport-sessions \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 8080
```

Cloud Run va :
1. ✅ Détecter le Dockerfile
2. ✅ Builder l'image (Vite + Nginx)
3. ✅ Déployer et générer une URL publique
4. ✅ Nginx proxifiera automatiquement les requêtes API (plus de CORS !)

L'URL sera : `https://doinsport-sessions-xxxxx.run.app/doinsport-sessions/`

**Bonus** : Tu peux mettre à jour la base de données des clubs via des secrets Cloud Run 
(voir section Variables d'environnement ci-dessous).

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

**GitHub Pages** : gratuit, mais l'API Doinsport peut bloquer les requêtes depuis `github.io`.

**Cloud Run + Nginx Proxy** : L'app inclut un proxy CORS intelligent :
- Si servie depuis Cloud Run → Nginx proxifie automatiquement les requêtes vers Doinsport
- Si servie depuis GitHub Pages → les appels vont directement (risque de CORS)
- Si servie depuis localhost → directes également

**Comment ça marche :**

```
GitHub Pages:
Client (github.io) → [CORS bloqué] → Doinsport API ❌

Cloud Run:
Client (run.app) → Nginx proxy (/api-proxy/*) → Doinsport API ✅
                   (ajoute les bons headers CORS)
```

L'app détecte automatiquement le contexte et transforme les URLs :
- `https://api-principale.doinsport.club/api/login_check` 
- → `/api-proxy/api-principale/api/login_check` (sur Cloud Run)
- → reste direct sur GitHub Pages

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

## 🤖 Automatiser le déploiement Cloud Run

Si tu veux que chaque `git push` déploie automatiquement sur Cloud Run (avec GitHub Actions),
suis le guide complet :

👉 **[CLOUD_RUN_SETUP.md](./CLOUD_RUN_SETUP.md)** — Configuration du service account, secrets GitHub, et workflow automatisé

Ce guide t'apprend les bases de l'CI/CD avec GitHub Actions + Google Cloud. C'est une excellente
learning experience ! 🚀
