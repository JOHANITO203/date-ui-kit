# Build context: backend/
FROM node:22-alpine AS builder
WORKDIR /app

COPY prisma ./prisma
COPY services/profile-service/package*.json ./
RUN npm ci
RUN npx prisma generate --schema=./prisma/schema.prisma
COPY services/profile-service/src ./src
COPY services/profile-service/tsconfig.json ./
RUN npm run build

# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY services/profile-service/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist

USER node
EXPOSE 4022
CMD ["node", "dist/index.js"]
