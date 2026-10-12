# Backend Production Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    postgresql-client \
    openssl

# Copy package files
COPY package*.json ./

# Install dependencies
# npm ci penuh: tahap build BUTUH devDependency (typescript) untuk `npm run build`
RUN npm config set allow-scripts true && npm ci

# Install prisma CLI
RUN npm install -g prisma

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Buang devDependency untuk image final (typescript, tsx, prisma CLI lokal, dll)
RUN npm prune --omit=dev

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    postgresql-client \
    openssl \
    dumb-init

# Prisma CLI global → dipakai `prisma migrate deploy` saat container start
RUN npm install -g prisma@5.22.0

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start production server
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]