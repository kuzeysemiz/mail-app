# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Build arguments
ARG REACT_APP_API_URL=http://localhost:5000/api

# Bağımlılıkları kopy et ve yükle
COPY package*.json ./
RUN npm ci

# Kaynak kodunu kopy et
COPY . .

# Production build yap
RUN npm run build

# Production stage - Nginx
FROM nginx:alpine

# Nginx konfigürasyonunu kopy et
COPY nginx.conf /etc/nginx/nginx.conf
COPY default.conf /etc/nginx/conf.d/default.conf

# Build çıktısını kopy et
COPY --from=builder /app/build /usr/share/nginx/html

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000 || exit 1

# Nginx başlat
CMD ["nginx", "-g", "daemon off;"]
