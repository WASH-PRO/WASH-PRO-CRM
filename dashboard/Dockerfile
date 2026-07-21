# bookworm (glibc): Vite 8 / rolldown optional native bindings are unreliable on Alpine musl
# ("Cannot find module '@rolldown/binding-linux-x64-musl'" during npm run build).
FROM node:20-bookworm-slim AS builder
WORKDIR /app
ARG VITE_APP_VERSION=1.0.0
ENV VITE_APP_VERSION=$VITE_APP_VERSION
COPY package*.json ./
# Vite 8 / rolldown: npm sometimes skips platform optional native bindings in Docker.
RUN npm install \
  && npm install --no-save @rolldown/binding-linux-x64-gnu \
  || npm install --no-save @rolldown/binding-linux-x64-musl \
  || true
COPY . .
RUN npm run build

FROM nginx:alpine
ARG VITE_APP_VERSION=1.0.0
COPY templates/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
COPY --from=builder /app/dist /usr/share/nginx/html
RUN printf '{"version":"%s"}\n' "$VITE_APP_VERSION" > /usr/share/nginx/html/version.json
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
