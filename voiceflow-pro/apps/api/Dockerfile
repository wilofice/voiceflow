# ─── Stage 1: Builder ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy monorepo root files needed for workspace resolution
COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY libs/ ./libs/

# Copy the API app
COPY apps/api/ ./apps/api/

# Install all dependencies (including dev — needed for tsc)
RUN npm ci --workspace=apps/api --include-workspace-root

# Build the API
WORKDIR /app/apps/api
RUN npm run build

# ─── Stage 2: Production image ────────────────────────────────────
FROM node:20-alpine AS production

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

WORKDIR /app

# Copy monorepo root for workspace resolution
COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY libs/ ./libs/

# Copy built API output
COPY apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Install production dependencies only
ENV NODE_ENV=production
RUN npm ci --workspace=apps/api --include-workspace-root --omit=dev

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S voiceflow -u 1001
USER voiceflow

WORKDIR /app/apps/api

# App Runner / ECS expect the app to listen on PORT env var
EXPOSE 3002

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
