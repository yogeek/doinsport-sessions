# ---- Stage 1 : build Vite ----
FROM node:20-alpine AS builder
WORKDIR /app

# Args pour pré-remplir la config au build (optionnels)
ARG VITE_DOINSPORT_BASE_URL
ARG VITE_DOINSPORT_CLUB_ID
ENV VITE_DOINSPORT_BASE_URL=$VITE_DOINSPORT_BASE_URL
ENV VITE_DOINSPORT_CLUB_ID=$VITE_DOINSPORT_CLUB_ID

# Cache des dépendances
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Build
COPY . .
RUN npm run build

# ---- Stage 2 : runtime nginx ----
FROM nginx:1.27-alpine AS runtime

# Nginx sans root (Cloud Run aime bien les images légères)
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Cloud Run fournit $PORT (8080 par défaut)
ENV PORT=8080
EXPOSE 8080

# nginx:alpine a déjà un entrypoint qui fait envsubst sur /etc/nginx/templates
CMD ["nginx", "-g", "daemon off;"]
