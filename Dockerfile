# syntax=docker/dockerfile:1

# ---- dependencies -----------------------------------------------------------
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm install

# ---- build ------------------------------------------------------------------
FROM deps AS build
COPY . .
RUN npm run build -w @courtly/contracts \
 && npm run build -w @courtly/api \
 && npm run build -w @courtly/web

# ---- api runtime ------------------------------------------------------------
FROM node:22-slim AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]

# ---- web runtime ------------------------------------------------------------
FROM nginx:1.27-alpine AS web
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
