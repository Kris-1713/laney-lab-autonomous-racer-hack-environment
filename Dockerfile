FROM node:20-bookworm-slim AS deps

WORKDIR /app/simulator

COPY simulator/package*.json ./
RUN npm ci

FROM node:20-bookworm-slim AS builder

WORKDIR /app/simulator

COPY --from=deps /app/simulator/node_modules ./node_modules
COPY simulator ./
RUN npm run build

FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production
WORKDIR /app/simulator

COPY --from=builder /app/simulator ./

EXPOSE 3000

CMD ["sh", "-c", "npm start -- --hostname 0.0.0.0 --port ${PORT:-3000}"]
