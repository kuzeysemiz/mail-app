# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Bağımlılıkları kopy et ve yükle
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine

WORKDIR /app

# Builder'dan node_modules'ü kopy et
COPY --from=builder /app/node_modules ./node_modules

# Uygulama kodunu kopy et
COPY . .

# Logs ve database klasörleri oluştur
RUN mkdir -p logs data

# Expose port
EXPOSE 10001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:10001/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "src/server.js"]
