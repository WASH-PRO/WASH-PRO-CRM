FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_APP_VERSION=1.0.0
ENV VITE_APP_VERSION=$VITE_APP_VERSION
COPY package*.json ./
RUN npm install
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
