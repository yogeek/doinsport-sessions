# 🚀 Déploiement automatisé sur Cloud Run

Ce guide te montre comment configurer le déploiement automatique de l'app sur Cloud Run à chaque `git push`.

## Architecture

```
git push → GitHub Actions (runner ubuntu)
         → gcloud auth (via service account)
         → docker build + push to Artifact Registry
         → gcloud run deploy
         → ✅ App live on Cloud Run
```

## 📋 Prérequis

- Un compte Google Cloud avec billing activé
- `gcloud` CLI installé localement
- Accès au repo GitHub avec droits admin

## 🔧 Setup en 5 min

### 1️⃣ Créer le service account

```bash
# Clone le script setup
bash ../setup-gcp-sa.sh YOUR_GCP_PROJECT_ID
```

Le script va :
- Créer un service account `github-deployer`
- Lui donner les rôles IAM nécessaires
- Générer une clé JSON
- Afficher la clé sur l'écran

**Copie la clé JSON entièrement** (tout ce qui est entre `{` et `}`).

### 2️⃣ Ajouter les secrets à GitHub

Va sur : https://github.com/yogeek/doinsport-sessions/settings/secrets/actions

**Ajoute 2 secrets** :

**Secret 1 : GCP_SA_KEY**
```
Name: GCP_SA_KEY
Value: [colle la clé JSON complète du script]
```

**Secret 2 : GCP_PROJECT_ID**
```
Name: GCP_PROJECT_ID
Value: your-gcp-project-id
```

### 3️⃣ Activer Artifact Registry sur GCP

```bash
# Activer l'API Artifact Registry
gcloud services enable artifactregistry.googleapis.com --project=YOUR_PROJECT_ID

# Créer un repo Docker (optionnel, gcloud peut le créer auto)
gcloud artifacts repositories create docker-repo \
  --repository-format=docker \
  --location=europe-west1 \
  --project=YOUR_PROJECT_ID
```

### 4️⃣ Test : Pousser sur main

```bash
git add .
git commit -m "feat: add Cloud Run automation"
git push origin main
```

**Va sur GitHub** → **Actions** → tu verras le workflow tourner.

**Attends 3-5 min**, et le service est déployé ! 🎉

La sortie finale affichera l'URL Cloud Run comme :
```
https://doinsport-sessions-xxxxx.run.app/doinsport-sessions/
```

---

## 🔍 Explication du workflow

Le fichier `.github/workflows/deploy-cloud-run.yml` fait ceci :

```yaml
# Trigger : chaque push sur main
on:
  push:
    branches:
      - main
    paths:  # Optionnel : déploie seulement si ces fichiers changent
      - 'src/**'
      - 'Dockerfile'
      - ...

# Secrets utilisés :
#   GCP_SA_KEY : clé JSON du service account
#   GCP_PROJECT_ID : ton projet GCP
```

**Étapes du workflow** :

1. **Checkout** : Clone le repo
2. **Authenticate** : S'authentifie via la clé du service account
3. **Setup gcloud** : Configure la CLI Google Cloud
4. **Docker login** : Se connecte à Artifact Registry
5. **Build** : Exécute `docker build` (Vite compile React, Nginx est configuré)
6. **Push** : Envoie l'image à Artifact Registry
7. **Deploy** : Appelle `gcloud run deploy` pour mettre en prod
8. **Output** : Affiche l'URL Cloud Run

---

## 💡 Comment ça marche côté Cloud Run

Une fois l'image envoyée, Cloud Run :

1. ✅ Crée (ou met à jour) un service `doinsport-sessions`
2. ✅ Lance un container depuis l'image
3. ✅ Expose le port 8080 (variable `PORT` auto)
4. ✅ Active HTTPS gratuit
5. ✅ Scale à 0 quand inutilisé (gratuit 👍)

**L'app est accessible à** : `https://doinsport-sessions-XXXXX.run.app/doinsport-sessions/`

---

## 🛑 Troubleshooting

### "Cannot find any run with github.run_id"
→ Ça vient du vieux workflow GitHub Pages. Tu peux supprimer `.github/workflows/deploy.yml` si tu ne veux que Cloud Run.

### "permission denied" sur Artifact Registry
→ Le service account n'a pas les bons rôles. Réexécute le script setup.

### "Cloud Build timeout"
→ C'est rare, mais le build peut prendre >1h s'il y a un problème npm. Regarde les logs :
```bash
gcloud builds log --limit=50 --project=YOUR_PROJECT_ID
```

### Vérifier le déploiement manuellement
```bash
gcloud run services describe doinsport-sessions \
  --region europe-west1 \
  --project YOUR_PROJECT_ID

# Afficher les logs
gcloud run logs read doinsport-sessions \
  --region europe-west1 \
  --project YOUR_PROJECT_ID \
  --limit=50
```

---

## 🎯 Bonus : Custom domain

Quand tout marche, tu peux ajouter un custom domain à Cloud Run :

```bash
gcloud run domain-mappings create \
  --service doinsport-sessions \
  --domain yourdomain.com \
  --region europe-west1 \
  --project YOUR_PROJECT_ID
```

---

## 📚 Resources

- [Cloud Run docs](https://cloud.google.com/run/docs)
- [GitHub Actions + GCP auth](https://github.com/google-github-actions/auth)
- [Artifact Registry](https://cloud.google.com/artifact-registry/docs)

---

**T'as des questions ?** Demande ! 👍
