#!/bin/bash
# Script pour créer un service account GitHub Actions sur GCP

set -e

# À adapter
PROJECT_ID="${1:-}"
if [ -z "$PROJECT_ID" ]; then
  echo "Usage: $0 YOUR_GCP_PROJECT_ID"
  echo "Exemple: $0 my-awesome-project-12345"
  exit 1
fi

echo "📝 Configuration du projet: $PROJECT_ID"
gcloud config set project "$PROJECT_ID"

echo ""
echo "🤖 Création du service account 'github-deployer'..."
gcloud iam service-accounts create github-deployer \
  --display-name="GitHub Actions Deployer for doinsport-sessions" \
  2>/dev/null || echo "   (service account existe déjà, c'est OK)"

SA_EMAIL="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
echo "   Email du service account: $SA_EMAIL"

# Attendre un peu que le service account soit créé
sleep 2

echo ""
echo "🔑 Attribution des rôles IAM..."

# Rôle 1 : Cloud Run Admin
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/run.admin" \
  --quiet

# Rôle 2 : Service Account User
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/iam.serviceAccountUser" \
  --quiet

# Bonus : Artifact Registry Writer (pour push les images Docker)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/artifactregistry.writer" \
  --quiet

echo "   ✅ Rôles attribués"

echo ""
echo "📄 Création de la clé JSON..."
KEY_FILE="${HOME}/gcp-sa-key-${PROJECT_ID}.json"
gcloud iam service-accounts keys create "$KEY_FILE" \
  --iam-account="$SA_EMAIL"

echo "   ✅ Clé créée: $KEY_FILE"

echo ""
echo "🔐 Contenu de la clé (pour GitHub Secrets):"
echo "=========================================="
cat "$KEY_FILE"
echo "=========================================="

echo ""
echo "📋 Prochaines étapes:"
echo "1. Copie le JSON complet ci-dessus (tout entre { et })"
echo "2. Va sur: https://github.com/yogeek/doinsport-sessions/settings/secrets/actions"
echo "3. Clique 'New repository secret'"
echo "4. Ajoute 2 secrets:"
echo ""
echo "   Secret 1:"
echo "   Name: GCP_SA_KEY"
echo "   Value: [colle le JSON complet]"
echo ""
echo "   Secret 2:"
echo "   Name: GCP_PROJECT_ID"
echo "   Value: $PROJECT_ID"
echo ""
echo "✅ Done!"