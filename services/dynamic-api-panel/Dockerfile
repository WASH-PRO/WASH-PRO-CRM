FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_WASH_EMBEDDED=true
ENV VITE_WASH_EMBEDDED=$VITE_WASH_EMBEDDED

COPY dynamic-api/frontend/package*.json ./
RUN npm install

COPY dynamic-api/frontend/ .
RUN npm run build

FROM nginx:alpine AS production

COPY config/dynamic-api/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
