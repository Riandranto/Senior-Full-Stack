# Frontend Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./
COPY client/package*.json ./client/
COPY tsconfig.json ./
COPY vite.config.ts ./

# Installer les dépendances
RUN npm ci && \
    cd client && npm ci

# Copier le code source
COPY client/ ./client/
COPY shared/ ./shared/

# Builder l'application frontend
RUN cd client && npm run build

# Stage de production avec Nginx
FROM nginx:alpine

# Installer curl pour healthcheck
RUN apk add --no-cache curl

# Copier les fichiers buildés
COPY --from=builder /app/client/dist /usr/share/nginx/html

# Copier la configuration Nginx personnalisée
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Créer un script d'entrée personnalisé
RUN echo '#!/bin/sh' > /docker-entrypoint.sh && \
    echo 'echo "🔧 Starting Nginx with environment variables..."' >> /docker-entrypoint.sh && \
    echo '# Remplacer les variables d\'environnement dans les fichiers JS' >> /docker-entrypoint.sh && \
    echo 'for file in /usr/share/nginx/html/assets/*.js; do' >> /docker-entrypoint.sh && \
    echo '  if [ -f "$file" ]; then' >> /docker-entrypoint.sh && \
    echo '    sed -i "s|VITE_API_URL_PLACEHOLDER|${VITE_API_URL}|g" "$file"' >> /docker-entrypoint.sh && \
    echo '  fi' >> /docker-entrypoint.sh && \
    echo 'done' >> /docker-entrypoint.sh && \
    echo 'echo "✅ Environment variables replaced"' >> /docker-entrypoint.sh && \
    echo 'nginx -g "daemon off;"' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

# Exposer les ports
EXPOSE 80
EXPOSE 443

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]