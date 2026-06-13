# Build context: . (project root)
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

# VITE vars are baked into the JS bundle at build time.
# Pass them via docker-compose build args (defaulted to APP_URL there).
# NOTE: an empty base URL makes the frontend fall back to mock data, so these
# must be the absolute app origin, not "".
ARG VITE_AUTH_BFF_URL=""
ARG VITE_DISCOVER_API_URL=""
ARG VITE_CHAT_API_URL=""
ARG VITE_PROFILE_API_URL=""
ARG VITE_SAFETY_API_URL=""
ARG VITE_PAYMENTS_API_URL=""
ARG VITE_MONITORING_LOG_ENDPOINT=""
ARG VITE_ANALYTICS_ENDPOINT=""

ENV VITE_AUTH_BFF_URL=$VITE_AUTH_BFF_URL
ENV VITE_DISCOVER_API_URL=$VITE_DISCOVER_API_URL
ENV VITE_CHAT_API_URL=$VITE_CHAT_API_URL
ENV VITE_PROFILE_API_URL=$VITE_PROFILE_API_URL
ENV VITE_SAFETY_API_URL=$VITE_SAFETY_API_URL
ENV VITE_PAYMENTS_API_URL=$VITE_PAYMENTS_API_URL
ENV VITE_MONITORING_LOG_ENDPOINT=$VITE_MONITORING_LOG_ENDPOINT
ENV VITE_ANALYTICS_ENDPOINT=$VITE_ANALYTICS_ENDPOINT

COPY . .
RUN npm run build

# ─────────────────────────────────────────────────────────────
# Unprivileged nginx: runs as non-root (uid 101) and listens on 8080.
FROM nginxinc/nginx-unprivileged:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
