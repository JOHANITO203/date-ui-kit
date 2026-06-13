# Build context: backend/
FROM node:22-alpine AS builder
WORKDIR /app

# Shared Prisma schema
COPY prisma ./prisma

# Service deps (includes dev deps for tsc + prisma CLI)
COPY services/auth-bff/package*.json ./
RUN npm ci

# Generate Prisma client for Alpine/musl
RUN npx prisma generate --schema=./prisma/schema.prisma

# Compile TypeScript
COPY services/auth-bff/src ./src
COPY services/auth-bff/tsconfig.json ./
RUN npm run build

# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Production deps only (sharp is a prod dep — npm ci downloads the musl binary)
COPY services/auth-bff/package*.json ./
RUN npm ci --omit=dev

# Overlay the generated Prisma client from builder (JS types + native engine binary)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

COPY --from=builder /app/dist ./dist

USER node
EXPOSE 8787
CMD ["node", "dist/index.js"]
