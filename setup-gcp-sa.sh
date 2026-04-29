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
  2>/dev/null || echo "   (service account existe déjà, pas de souci)"

SA_EMAIL="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
echo "   Email du service account: $SA_EMAIL"

echo ""
echo "🔑 Attribution des rôles IAM..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/run.admin" \
  --condition=None \
  --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/iam.serviceAccountUser" \
  --condition=None \
  --quiet

echo "   ✅ Rôles attribués"

echo ""
echo "📄 Création de la clé JSON..."
KEY_FILE="${HOME}/Downloads/gcp-sa-key-${PROJECT_ID}.json"
gcloud iam service-accounts keys create "$KEY_FILE" \
  --iam-account="$SA_EMAIL"

echo "   ✅ Clé créée: $KEY_FILE"

echo ""
echo "🔐 Affichage de la clé (pour la copier dans GitHub Secrets):"
echo "=========================================="
cat "$KEY_FILE"
echo "=========================================="

echo ""
echo "📋 Prochaines étapes:"
echo "1. Va sur: https://github.com/yogeek/doinsport-sessions/settings/secrets/actions"
echo "2. Clique 'New repository secret'"
echo "3. Nom: GCP_SA_KEY"
echo "4. Valeur: (copie-colle le JSON complet ci-dessus)"
echo "5. Ajoute un 2e secret:"
echo "   Nom: GCP_PROJECT_ID"
echo "   Valeur: $PROJECT_ID"
echo ""
echo "✅ Done!"
