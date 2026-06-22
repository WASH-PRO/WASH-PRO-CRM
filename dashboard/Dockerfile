FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_APP_VERSION=1.0.0
ENV VITE_APP_VERSION=$VITE_APP_VERSION
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
