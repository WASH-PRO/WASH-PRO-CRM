FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# ─── Development ──────────────────────────────────────────────────────────────
FROM base AS development
RUN chmod +x docker-entrypoint.dev.sh
EXPOSE 5173
ENTRYPOINT ["./docker-entrypoint.dev.sh"]

# ─── Production build ─────────────────────────────────────────────────────────
FROM base AS production-build
RUN npm run build

FROM nginx:alpine AS production
COPY --from=production-build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
